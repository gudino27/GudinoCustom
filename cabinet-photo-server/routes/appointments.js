// Appointment Booking Routes
// Handles appointment creation, management, and employee availability

const moment = require('moment-timezone');
const express = require('express');
const router = express.Router();
const { appointmentDb, employeeDb } = require('../db-helpers');
const { authenticateUser, requireRole } = require('../middleware/auth');
const { handleError } = require('../utils/error-handler');
const {
  emailTransporter,
  generateAppointmentConfirmationEmail,
  generateAppointmentReminderEmail,
  generateAppointmentCancellationEmail,
} = require('../utils/email');
const { sendSmsWithRouting, sendSMS } = require('../utils/sms');
const crypto = require('crypto');

// PUBLIC ROUTES - Customer Appointment Booking

// Get available dates for a specific month (for calendar highlighting)
router.get('/api/appointments/available-dates/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const yearInt = parseInt(year);
    const monthInt = parseInt(month);

    if (isNaN(yearInt) || isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
      return res.status(400).json({ error: 'Invalid year or month' });
    }

    // Get all employee availability (any day that has at least one employee available)
    const allAvailability = await appointmentDb.getAllEmployeeAvailability();

    if (!allAvailability || allAvailability.length === 0) {
      return res.json({ availableDates: [] });
    }

    // Get the days of week that have availability
    const availableDaysOfWeek = new Set(
      allAvailability
        .filter(a => a.is_available)
        .map(a => a.day_of_week)
    );

    // Generate all dates in the month that fall on available days
    const availableDates = [];
    const firstDay = new Date(yearInt, monthInt - 1, 1);
    const lastDay = new Date(yearInt, monthInt, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      // Only include future dates (or today)
      if (d >= today && availableDaysOfWeek.has(d.getDay())) {
        // Check if entire day is blocked
        const dateStr = d.toISOString().split('T')[0];
        const blockedTimes = await appointmentDb.getBlockedTimesByDate(dateStr);

        // If not fully blocked, add to available dates
        const isFullyBlocked = blockedTimes.some(bt => {
          // Check if block covers entire business day (simplified check)
          return bt.all_day === 1;
        });

        if (!isFullyBlocked) {
          availableDates.push(dateStr);
        }
      }
    }

    res.json({ availableDates });
  } catch (error) {
    handleError(error, 'Failed to fetch available dates', res, 500);
  }
});

// Get available time slots for a specific date
// The open times for a date (YYYY-MM-DD), as shown to the person booking
async function findOpenSlots(date, durationMinutes) {
  // Parse date properly to avoid timezone issues
  // Date format is YYYY-MM-DD, parse as local date
  const [year, month, day] = date.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  const dayOfWeek = localDate.getDay();

  // Get all employee availability for the day of week
  const availability = await appointmentDb.getEmployeeAvailabilityByDay(dayOfWeek);

  if (!availability || availability.length === 0) {
    return { slots: [], generatedSlots: [] };
  }

  // Get existing appointments for this date
  const existingAppointments = await appointmentDb.getAppointmentsByDate(date);

  // Get blocked times for this date
  const blockedTimes = await appointmentDb.getBlockedTimesByDate(date);

  // Generate available time slots
  const generatedSlots = generateTimeSlots(
    availability,
    existingAppointments,
    blockedTimes,
    date,
    durationMinutes
  );

  // Format slots as 24-hour time strings for the frontend (HH:MM format)
  const slots = generatedSlots.map(slot => {
    const slotDate = new Date(slot.time);
    const hours = slotDate.getHours().toString().padStart(2, '0');
    const minutes = slotDate.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  });

  return { slots, generatedSlots };
}

// Supports both path param (/available-slots/:date) and query param (?date=...)
const getAvailableSlotsHandler = async (req, res) => {
  try {
    const date = req.params.date || req.query.date;
    const duration = req.query.duration;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Return both formats for compatibility
    const { slots, generatedSlots } = await findOpenSlots(date, parseInt(duration) || 60);
    res.json({ slots, availableSlots: generatedSlots });
  } catch (error) {
    handleError(error, 'Failed to fetch available slots', res, 500);
  }
};

router.get('/api/appointments/available-slots/:date', getAvailableSlotsHandler);
router.get('/api/appointments/available-slots', getAvailableSlotsHandler);

// Book an appointment (public endpoint)
router.post('/api/appointments/book', async (req, res) => {
  try {
    const {
      client_name,
      client_email,
      client_phone,
      client_language,
      appointment_type,
      appointment_date,
      duration,
      location_address,
      notes,
    } = req.body;

    // Validate required fields
    if (!client_name || !client_email || !client_phone || !appointment_type || !appointment_date) {
      return res.status(400).json({
        error: 'Missing required fields: client_name, client_email, client_phone, appointment_type, and appointment_date are required',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(client_email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate appointment type
    const validTypes = ['consultation', 'measurement', 'estimate', 'followup'];
    if (!validTypes.includes(appointment_type)) {
      return res.status(400).json({
        error: 'Invalid appointment_type. Must be one of: consultation, measurement, estimate, followup',
      });
    }

    // The page sends UTC; open slots are shop clock times
    const requested = moment(appointment_date).tz('America/Los_Angeles');
    if (!requested.isValid()) {
      return res.status(400).json({ error: 'Invalid appointment_date' });
    }

    const { slots } = await findOpenSlots(requested.format('YYYY-MM-DD'), parseInt(duration) || 60);
    if (!slots.includes(requested.format('HH:mm'))) {
      return res.status(409).json({ error: 'That time is no longer available. Please pick another.' });
    }

    // Generate cancellation token for this appointment
    const cancellationToken = crypto.randomBytes(32).toString('hex');

    // Find an available employee for this appointment
    const assignedEmployee = await appointmentDb.findAvailableEmployee(appointment_date, duration || 60);

    // Create appointment
    const appointmentId = await appointmentDb.createAppointment({
      client_name,
      client_email,
      client_phone,
      client_language: client_language || 'en',
      appointment_type,
      appointment_date,
      duration: duration || 60,
      status: 'pending',
      location_address: location_address || null,
      notes: notes || null,
      assigned_employee_id: assignedEmployee ? assignedEmployee.id : null,
      cancellation_token: cancellationToken,
    });

    const appointment = await appointmentDb.getAppointmentById(appointmentId);

    // Send confirmation email to client
    try {
      const confirmationEmailOptions = generateAppointmentConfirmationEmail({
        clientName: client_name,
        clientEmail: client_email,
        appointmentType: appointment_type,
        appointmentDate: appointment_date,
        duration: duration || 60,
        language: client_language || 'en',
        cancellationToken,
      });
      await emailTransporter.sendMail(confirmationEmailOptions);
      console.log(`✉️  Appointment confirmation email sent to ${client_email}`);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    // Send SMS notification to admin
    try {
      const appointmentTypeLabels = {
        consultation: 'Consultation',
        measurement: 'Measurement',
        estimate: 'Estimate',
        followup: 'Follow-up',
      };
      const formattedDate = new Date(appointment_date).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const smsMessage = `New Appointment Booked!\n\nClient: ${client_name}\nType: ${appointmentTypeLabels[appointment_type]}\nDate: ${formattedDate}\nPhone: ${client_phone}\n\nView details in admin panel: https://gudinocustom.com/admin`;

      await sendSmsWithRouting('appointment_booking', smsMessage);
      console.log(`📱 SMS notification sent to admin`);
    } catch (smsError) {
      console.error('Failed to send SMS notification:', smsError);
    }

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      appointmentId,
      appointment,
      cancellationUrl: `https://gudinocustom.com/appointment/cancel/${cancellationToken}`,
    });
  } catch (error) {
    handleError(error, 'Failed to book appointment', res, 500);
  }
});

// Cancel appointment (public endpoint with token)
router.post('/api/appointments/cancel/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { reason } = req.body;

    const appointment = await appointmentDb.getAppointmentByToken(token);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found or invalid cancellation link' });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ error: 'Appointment is already cancelled' });
    }

    // Cancel the appointment
    await appointmentDb.cancelAppointment(appointment.id, reason || 'Client requested cancellation');

    // Send cancellation confirmation email
    try {
      const cancellationEmailOptions = generateAppointmentCancellationEmail({
        clientName: appointment.client_name,
        clientEmail: appointment.client_email,
        appointmentType: appointment.appointment_type,
        appointmentDate: appointment.appointment_date,
        language: appointment.client_language,
      });
      await emailTransporter.sendMail(cancellationEmailOptions);
      console.log(`✉️  Appointment cancellation email sent to ${appointment.client_email}`);
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError);
    }

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
    });
  } catch (error) {
    handleError(error, 'Failed to cancel appointment', res, 500);
  }
});

// Get appointment details by token (for cancel/reschedule page)
// Supports both /details/:token and /by-token/:token for compatibility
const getAppointmentByTokenHandler = async (req, res) => {
  try {
    const { token } = req.params;

    const appointment = await appointmentDb.getAppointmentByToken(token);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Return limited appointment details (no sensitive info)
    res.json({
      id: appointment.id,
      client_name: appointment.client_name,
      appointment_type: appointment.appointment_type,
      appointment_date: appointment.appointment_date,
      duration: appointment.duration,
      status: appointment.status,
      location_address: appointment.location_address,
    });
  } catch (error) {
    handleError(error, 'Failed to fetch appointment details', res, 500);
  }
};

router.get('/api/appointments/details/:token', getAppointmentByTokenHandler);
router.get('/api/appointments/by-token/:token', getAppointmentByTokenHandler);

// ADMIN ROUTES - Appointment Management

// Get all appointments (admin only)
router.get('/api/admin/appointments', authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { status, startDate, endDate, filter } = req.query;

    let appointments;
    const statusFilter = status !== 'all' ? status : null;

    // Handle date filter presets
    if (filter && filter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let filterStartDate, filterEndDate;

      switch (filter) {
        case 'today':
          filterStartDate = today.toISOString().split('T')[0];
          filterEndDate = today.toISOString().split('T')[0];
          break;
        case 'upcoming':
          filterStartDate = today.toISOString().split('T')[0];
          const futureDate = new Date(today);
          futureDate.setFullYear(futureDate.getFullYear() + 1);
          filterEndDate = futureDate.toISOString().split('T')[0];
          break;
        case 'week':
          filterStartDate = today.toISOString().split('T')[0];
          const weekEnd = new Date(today);
          weekEnd.setDate(weekEnd.getDate() + 7);
          filterEndDate = weekEnd.toISOString().split('T')[0];
          break;
        case 'past':
          const pastStart = new Date(today);
          pastStart.setFullYear(pastStart.getFullYear() - 1);
          filterStartDate = pastStart.toISOString().split('T')[0];
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          filterEndDate = yesterday.toISOString().split('T')[0];
          break;
        default:
          filterStartDate = null;
          filterEndDate = null;
      }

      if (filterStartDate && filterEndDate) {
        appointments = await appointmentDb.getAppointmentsByDateRange(filterStartDate, filterEndDate, statusFilter);
      } else {
        appointments = await appointmentDb.getAllAppointments(statusFilter);
      }
    } else if (startDate && endDate) {
      appointments = await appointmentDb.getAppointmentsByDateRange(startDate, endDate, statusFilter);
    } else {
      appointments = await appointmentDb.getAllAppointments(statusFilter);
    }

    res.json({ appointments: appointments || [] });
  } catch (error) {
    handleError(error, 'Failed to fetch appointments', res, 500);
  }
});

// Get appointment by ID (admin only)
router.get('/api/admin/appointments/:id', authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await appointmentDb.getAppointmentById(parseInt(id));

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json(appointment);
  } catch (error) {
    handleError(error, 'Failed to fetch appointment', res, 500);
  }
});

// Update appointment status (admin only)
router.patch('/api/admin/appointments/:id/status', authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show', 'needs_reschedule'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await appointmentDb.updateAppointmentStatus(parseInt(id), status);
    const appointment = await appointmentDb.getAppointmentById(parseInt(id));

    // Send confirmation email if status changed to confirmed
    if (status === 'confirmed' && appointment) {
      try {
        const confirmationEmail = {
          from: process.env.EMAIL_FROM || 'noreply@gudinocustom.com',
          to: appointment.client_email,
          subject: appointment.client_language === 'es'
            ? 'Cita Confirmada - Gudino Custom'
            : 'Appointment Confirmed - Gudino Custom',
          html: appointment.client_language === 'es'
            ? `<h2>¡Su cita ha sido confirmada!</h2>
               <p>Hola ${appointment.client_name},</p>
               <p>Su cita ha sido confirmada para el ${new Date(appointment.appointment_date).toLocaleString('es-US')}.</p>
               <p>Nos vemos pronto!</p>`
            : `<h2>Your appointment has been confirmed!</h2>
               <p>Hello ${appointment.client_name},</p>
               <p>Your appointment has been confirmed for ${new Date(appointment.appointment_date).toLocaleString('en-US')}.</p>
               <p>We look forward to seeing you!</p>`
        };
        await emailTransporter.sendMail(confirmationEmail);
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }
    }

    res.json({ success: true, appointment });
  } catch (error) {
    handleError(error, 'Failed to update appointment status', res, 500);
  }
});

// Request client to reschedule (admin only)
router.post('/api/admin/appointments/:id/request-reschedule', authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    const appointment = await appointmentDb.getAppointmentById(parseInt(id));

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Update status to needs_reschedule
    await appointmentDb.updateAppointmentStatus(parseInt(id), 'needs_reschedule');

    // Send email to client asking them to reschedule
    try {
      const rescheduleUrl = `https://gudinocustom.com/book-appointment`;
      const cancelUrl = `https://gudinocustom.com/appointment/cancel/${appointment.cancellation_token}`;

      const rescheduleEmail = {
        from: process.env.EMAIL_FROM || 'noreply@gudinocustom.com',
        to: appointment.client_email,
        subject: appointment.client_language === 'es'
          ? 'Solicitud de Reprogramación - Gudino Custom'
          : 'Reschedule Request - Gudino Custom',
        html: appointment.client_language === 'es'
          ? `<h2>Solicitud de Reprogramación</h2>
             <p>Hola ${appointment.client_name},</p>
             <p>Desafortunadamente, necesitamos reprogramar su cita del ${new Date(appointment.appointment_date).toLocaleString('es-US')}.</p>
             ${message ? `<p><strong>Mensaje:</strong> ${message}</p>` : ''}
             <p>Por favor, seleccione un nuevo horario que le convenga:</p>
             <p><a href="${rescheduleUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;">Reprogramar Cita</a></p>
             <p>Si necesita cancelar en lugar de reprogramar: <a href="${cancelUrl}">Cancelar Cita</a></p>
             <p>Disculpe las molestias.</p>`
          : `<h2>Reschedule Request</h2>
             <p>Hello ${appointment.client_name},</p>
             <p>Unfortunately, we need to reschedule your appointment on ${new Date(appointment.appointment_date).toLocaleString('en-US')}.</p>
             ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
             <p>Please select a new time that works for you:</p>
             <p><a href="${rescheduleUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;">Reschedule Appointment</a></p>
             <p>If you need to cancel instead: <a href="${cancelUrl}">Cancel Appointment</a></p>
             <p>We apologize for any inconvenience.</p>`
      };
      await emailTransporter.sendMail(rescheduleEmail);
      console.log(`✉️  Reschedule request email sent to ${appointment.client_email}`);
    } catch (emailError) {
      console.error('Failed to send reschedule email:', emailError);
    }

    const updatedAppointment = await appointmentDb.getAppointmentById(parseInt(id));
    res.json({ success: true, appointment: updatedAppointment });
  } catch (error) {
    handleError(error, 'Failed to request reschedule', res, 500);
  }
});

// Update appointment (admin only)
router.patch('/api/admin/appointments/:id', authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Get original appointment to check if employee assignment changed
    const originalAppointment = await appointmentDb.getAppointmentById(parseInt(id));

    await appointmentDb.updateAppointment(parseInt(id), updates);
    const appointment = await appointmentDb.getAppointmentById(parseInt(id));

    // If employee was assigned, send them an SMS notification
    if (updates.assigned_employee_id &&
        updates.assigned_employee_id !== originalAppointment?.assigned_employee_id) {
      try {
        const employee = await employeeDb.getEmployeeById(updates.assigned_employee_id);
        if (employee && employee.phone) {
          const appointmentDate = new Date(appointment.appointment_date);
          const dateStr = appointmentDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          });
          const timeStr = appointmentDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });

          const smsMessage = `New appointment assigned to you!\n` +
            `📅 ${dateStr} at ${timeStr}\n` +
            `👤 ${appointment.client_name}\n` +
            `📋 ${appointment.appointment_type}\n` +
            `📍 ${appointment.location_address || 'See admin panel'}\n` +
            `📞 ${appointment.client_phone}`;

          await sendSMS(employee.phone, smsMessage);
          console.log(`📱 SMS notification sent to employee ${employee.name} at ${employee.phone}`);
        }
      } catch (smsError) {
        console.error('Failed to send employee SMS notification:', smsError);
        // Don't fail the request if SMS fails
      }
    }

    res.json({ success: true, appointment });
  } catch (error) {
    handleError(error, 'Failed to update appointment', res, 500);
  }
});

// Delete appointment (admin only)
router.delete('/api/admin/appointments/:id', authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { id } = req.params;

    await appointmentDb.deleteAppointment(parseInt(id));

    res.json({ success: true, message: 'Appointment deleted successfully' });
  } catch (error) {
    handleError(error, 'Failed to delete appointment', res, 500);
  }
});

// EMPLOYEE AVAILABILITY ROUTES (admin only)

// Get all employee availability
router.get('/api/admin/employee-availability', authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { employeeId } = req.query;

    let availability;
    if (employeeId) {
      availability = await appointmentDb.getEmployeeAvailability(parseInt(employeeId));
    } else {
      availability = await appointmentDb.getAllEmployeeAvailability();
    }

    res.json(availability);
  } catch (error) {
    handleError(error, 'Failed to fetch employee availability', res, 500);
  }
});

// Create employee availability
router.post('/api/admin/employee-availability', authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { employee_id, day_of_week, start_time, end_time } = req.body;

    if (employee_id === undefined || day_of_week === undefined || !start_time || !end_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const availabilityId = await appointmentDb.createEmployeeAvailability({
      employee_id,
      day_of_week,
      start_time,
      end_time,
      is_available: true,
    });

    const availability = await appointmentDb.getEmployeeAvailabilityById(availabilityId);

    res.status(201).json({ success: true, availability });
  } catch (error) {
    handleError(error, 'Failed to create employee availability', res, 500);
  }
});

// Update employee availability
router.patch('/api/admin/employee-availability/:id', authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    await appointmentDb.updateEmployeeAvailability(parseInt(id), updates);
    const availability = await appointmentDb.getEmployeeAvailabilityById(parseInt(id));

    res.json({ success: true, availability });
  } catch (error) {
    handleError(error, 'Failed to update employee availability', res, 500);
  }
});

// Delete employee availability
router.delete('/api/admin/employee-availability/:id', authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { id } = req.params;

    await appointmentDb.deleteEmployeeAvailability(parseInt(id));

    res.json({ success: true, message: 'Employee availability deleted successfully' });
  } catch (error) {
    handleError(error, 'Failed to delete employee availability', res, 500);
  }
});

// Get availability for a specific employee (alternate route for frontend)
router.get('/api/admin/employees/:employeeId/availability', authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { employeeId } = req.params;

    const availability = await appointmentDb.getEmployeeAvailability(parseInt(employeeId));

    res.json({ availability: availability || [] });
  } catch (error) {
    handleError(error, 'Failed to fetch employee availability', res, 500);
  }
});

// BLOCKED TIMES ROUTES (admin only)

// Get blocked times
router.get('/api/admin/blocked-times', authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.query;

    let blockedTimes;
    if (startDate && endDate) {
      blockedTimes = await appointmentDb.getBlockedTimesByDateRange(startDate, endDate, employeeId);
    } else if (employeeId) {
      blockedTimes = await appointmentDb.getBlockedTimesByEmployee(parseInt(employeeId));
    } else {
      blockedTimes = await appointmentDb.getAllBlockedTimes();
    }

    res.json({ blockedTimes: blockedTimes || [] });
  } catch (error) {
    handleError(error, 'Failed to fetch blocked times', res, 500);
  }
});

// Create blocked time
router.post('/api/admin/blocked-times', authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { employee_id, start_datetime, end_datetime, reason, notes } = req.body;

    if (!employee_id || !start_datetime || !end_datetime || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const blockedTimeId = await appointmentDb.createBlockedTime({
      employee_id,
      start_datetime,
      end_datetime,
      reason,
      notes: notes || null,
      created_by: req.user.id,
    });

    const blockedTime = await appointmentDb.getBlockedTimeById(blockedTimeId);

    res.status(201).json({ success: true, blockedTime });
  } catch (error) {
    handleError(error, 'Failed to create blocked time', res, 500);
  }
});

// Update blocked time
router.patch('/api/admin/blocked-times/:id', authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    await appointmentDb.updateBlockedTime(parseInt(id), updates);
    const blockedTime = await appointmentDb.getBlockedTimeById(parseInt(id));

    res.json({ success: true, blockedTime });
  } catch (error) {
    handleError(error, 'Failed to update blocked time', res, 500);
  }
});

// Delete blocked time
router.delete('/api/admin/blocked-times/:id', authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { id } = req.params;

    await appointmentDb.deleteBlockedTime(parseInt(id));

    res.json({ success: true, message: 'Blocked time deleted successfully' });
  } catch (error) {
    handleError(error, 'Failed to delete blocked time', res, 500);
  }
});

// HELPER FUNCTIONS

// Generate available time slots based on employee availability, existing appointments, and blocked times
function generateTimeSlots(availability, existingAppointments, blockedTimes, date, durationMinutes) {
  const slots = [];

  // Parse date properly to avoid timezone issues (YYYY-MM-DD format)
  const [year, month, day] = date.split('-').map(Number);
  const appointmentDate = new Date(year, month - 1, day);

  // For each available employee
  availability.forEach((avail) => {
    const [startHour, startMinute] = avail.start_time.split(':').map(Number);
    const [endHour, endMinute] = avail.end_time.split(':').map(Number);

    let currentTime = new Date(year, month - 1, day, startHour, startMinute, 0, 0);

    const endTime = new Date(appointmentDate);
    endTime.setHours(endHour, endMinute, 0, 0);

    // Generate slots in 30-minute intervals
    while (currentTime < endTime) {
      const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60000);

      if (slotEnd <= endTime) {
        // Check if slot conflicts with existing appointments
        const hasConflict = existingAppointments.some((apt) => {
          const aptStart = new Date(apt.appointment_date);
          const aptEnd = new Date(aptStart.getTime() + apt.duration * 60000);
          return (
            apt.assigned_employee_id === avail.employee_id &&
            apt.status !== 'cancelled' &&
            ((currentTime >= aptStart && currentTime < aptEnd) || (slotEnd > aptStart && slotEnd <= aptEnd))
          );
        });

        // Check if slot conflicts with blocked times
        const isBlocked = blockedTimes.some((blocked) => {
          const blockedStart = new Date(blocked.start_datetime);
          const blockedEnd = new Date(blocked.end_datetime);
          return (
            blocked.employee_id === avail.employee_id &&
            ((currentTime >= blockedStart && currentTime < blockedEnd) || (slotEnd > blockedStart && slotEnd <= blockedEnd))
          );
        });

        if (!hasConflict && !isBlocked) {
          slots.push({
            time: currentTime.toISOString(),
            employeeId: avail.employee_id,
            employeeName: avail.employee_name,
            duration: durationMinutes,
          });
        }
      }

      // Move to next 30-minute slot
      currentTime = new Date(currentTime.getTime() + 30 * 60000);
    }
  });

  return slots;
}

module.exports = router;
