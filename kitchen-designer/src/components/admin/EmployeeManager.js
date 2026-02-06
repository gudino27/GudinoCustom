import React, { useState, useEffect } from 'react';
import { User, Trash2, Edit2, Save, Plus, GripVertical, Mail, Phone, Calendar } from 'lucide-react';
import { formatDatePacific } from '../../utils/dateUtils';
import { useLanguage } from '../../contexts/LanguageContext';
import sessionManager from '../utils/sessionManager';

const EmployeeManager = () => {
  const { t } = useLanguage();
  const getAuthHeaders = () => {
    const session = sessionManager.getSession();
    return session?.token ? { 'Authorization': `Bearer ${session.token}` } : {};
  };
  const [employees, setEmployees] = useState([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isReordering, setIsReordering] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);

  const API_BASE = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';

  // New employee form state
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    position: '',
    bio: '',
    email: '',
    phone: '',
    joined_date: '',
    photo: null
  });

  useEffect(() => { loadEmployees(); }, []);

  const loadEmployees = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/employees`);
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Failed to load employees:', error);
      showNotification('Failed to load employees', 'error');
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddEmployee = async () => {
    if (!newEmployee.name || !newEmployee.position) {
      showNotification(t('employeeManager.nameRequired'), 'error');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('name', newEmployee.name);
      formData.append('position', newEmployee.position);
      formData.append('bio', newEmployee.bio);
      formData.append('email', newEmployee.email);
      formData.append('phone', newEmployee.phone);
      formData.append('joined_date', newEmployee.joined_date);

      if (newEmployee.photo) {
        formData.append('photo', newEmployee.photo);
      }

      const response = await fetch(`${API_BASE}/api/employees`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        setEmployees([...employees, result.employee]);
        setNewEmployee({
          name: '',
          position: '',
          bio: '',
          email: '',
          phone: '',
          joined_date: '',
          photo: null
        });
        setIsAddingNew(false);
        showNotification('Employee added successfully!');
      } else {
        showNotification('Failed to add employee', 'error');
      }
    } catch (error) {
      console.error('Error adding employee:', error);
      showNotification('Failed to add employee', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmployee = async (id, updates, photoFile = null) => {
    setLoading(true);

    try {
      const formData = new FormData();
      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          formData.append(key, updates[key]);
        }
      });

      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const response = await fetch(`${API_BASE}/api/employees/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        setEmployees(employees.map(emp =>
          emp.id === id ? result.employee : emp
        ));
        setEditingId(null);
        showNotification(t('employeeManager.updated'));
      } else {
        showNotification(t('employeeManager.updated'), 'error');
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      showNotification('Failed to update employee', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (!window.confirm(t('employeeManager.deleteConfirm'))) return;

    try {
      const response = await fetch(`${API_BASE}/api/employees/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setEmployees(employees.filter(emp => emp.id !== id));
        showNotification(t('employeeManager.deleted'));
      } else {
        showNotification(t('employeeManager.deleted'), 'error');
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      showNotification('Failed to delete employee', 'error');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedItem === null) return;

    const newEmployees = [...employees];
    const draggedEmployee = newEmployees[draggedItem];

    newEmployees.splice(draggedItem, 1);
    newEmployees.splice(dropIndex, 0, draggedEmployee);

    setEmployees(newEmployees);
    setDraggedItem(null);
  };

  const saveOrder = async () => {
    const employeeIds = employees.map(emp => emp.id);

    try {
      const response = await fetch(`${API_BASE}/api/employees/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ employeeIds })
      });

      if (response.ok) {
        showNotification(t('employeeManager.saveOrder'));
        setIsReordering(false);
      } else {
        showNotification(t('employeeManager.saveOrder'), 'error');
      }
    } catch (error) {
      console.error('Save order error:', error);
      showNotification('Failed to save order', 'error');
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition-all transform ${notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
          {notification.message}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">{t('employeeManager.title')}</h2>
        <div className="flex gap-2">
          {isReordering ? (
            <>
              <button
                onClick={saveOrder}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Save size={16} />
                {t('employeeManager.saveOrder')}
              </button>
              <button
                onClick={() => {
                  setIsReordering(false);
                  loadEmployees(); // Reset order
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                {t('employeeManager.cancel')}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsReordering(true)}
                className="flex items-center gap-2 px-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                <GripVertical size={16} />
                {t('employeeManager.reorder')}
              </button>
              <button
                onClick={() => setIsAddingNew(true)}
                className="flex items-center gap-2 px-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={20} />
                {t('employeeManager.addEmployee')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Add New Employee Form */}
      {isAddingNew && (
        <div className="mb-6 p-6 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">{t('employeeManager.addNewMember')}</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('employeeManager.name')} *</label>
                <input
                  type="text"
                  required
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('employeeManager.position')} *</label>
                <input
                  type="text"
                  required
                  value={newEmployee.position}
                  onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Senior Designer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('employeeManager.email')}</label>
                <input
                  type="email"
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="john@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('employeeManager.phone')}</label>
                <input
                  type="tel"
                  value={newEmployee.phone}
                  onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('employeeManager.joinedDate')}</label>
                <input
                  type="date"
                  value={newEmployee.joined_date}
                  onChange={(e) => setNewEmployee({ ...newEmployee, joined_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('employeeManager.photo')}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewEmployee({ ...newEmployee, photo: e.target.files[0] })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('employeeManager.bio')}</label>
              <textarea
                value={newEmployee.bio}
                onChange={(e) => setNewEmployee({ ...newEmployee, bio: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                rows="3"
                placeholder="Brief description about the employee..."
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
              <button
                onClick={handleAddEmployee}
                disabled={loading}
                className="px-4 py-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-center min-h-[44px] sm:min-h-auto"
              >
                {loading ? t('employeeManager.adding') : t('employeeManager.addEmployee')}
              </button>
              <button
                onClick={() => {
                  setIsAddingNew(false);
                  setNewEmployee({
                    name: '', position: '', bio: '', email: '', phone: '', joined_date: '', photo: null
                  });
                }}
                className="px-4 py-3 sm:py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-center min-h-[44px] sm:min-h-auto"
              >
                {t('employeeManager.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee List */}
      <div className="space-y-4">
        {employees.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <User size={48} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500">{t('employeeManager.noEmployees')}</p>
            <button
              onClick={() => setIsAddingNew(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {t('employeeManager.addFirst')}
            </button>
          </div>
        ) : (
          employees.map((employee, index) => (
            <div
              key={employee.id}
              className={`p-4 border rounded-lg relative ${isReordering ? 'cursor-move' : ''
                } ${draggedItem === index ? 'opacity-50' : ''}`}
              draggable={isReordering}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
            >
              <div className="flex items-start gap-4">
                {/* Photo */}
                <div className="flex-shrink-0">
                  {employee.photo_url ? (
                    <img
                      src={`${API_BASE}${employee.photo_url}`}
                      alt={employee.name}
                      className="w-24 h-24 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                      <User size={40} className="text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1">
                  {editingId === employee.id ? (
                    // Edit mode
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={employee.name}
                          onChange={(e) => setEmployees(employees.map(emp =>
                            emp.id === employee.id ? { ...emp, name: e.target.value } : emp
                          ))}
                          className="px-3 py-2 border rounded"
                          placeholder="Name"
                        />
                        <input
                          type="text"
                          value={employee.position}
                          onChange={(e) => setEmployees(employees.map(emp =>
                            emp.id === employee.id ? { ...emp, position: e.target.value } : emp
                          ))}
                          className="px-3 py-2 border rounded"
                          placeholder="Position"
                        />
                        <input
                          type="email"
                          value={employee.email || ''}
                          onChange={(e) => setEmployees(employees.map(emp =>
                            emp.id === employee.id ? { ...emp, email: e.target.value } : emp
                          ))}
                          className="px-3 py-2 border rounded"
                          placeholder="Email"
                        />
                        <input
                          type="tel"
                          value={employee.phone || ''}
                          onChange={(e) => setEmployees(employees.map(emp =>
                            emp.id === employee.id ? { ...emp, phone: e.target.value } : emp
                          ))}
                          className="px-3 py-2 border rounded"
                          placeholder="Phone"
                        />
                      </div>
                      <textarea
                        value={employee.bio || ''}
                        onChange={(e) => setEmployees(employees.map(emp =>
                          emp.id === employee.id ? { ...emp, bio: e.target.value } : emp
                        ))}
                        className="w-full px-3 py-2 border rounded"
                        rows="2"
                        placeholder="Bio"
                      />
                      <div className="flex gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              setEmployees(employees.map(emp =>
                                emp.id === employee.id ? { ...emp, newPhoto: file } : emp
                              ));
                            }
                          }}
                          className="text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const emp = employees.find(e => e.id === employee.id);
                            const updates = {
                              name: emp.name,
                              position: emp.position,
                              bio: emp.bio,
                              email: emp.email,
                              phone: emp.phone
                            };
                            handleUpdateEmployee(employee.id, updates, emp.newPhoto || null);
                          }}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          disabled={loading}
                        >
                          {t('employeeManager.save')}
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            loadEmployees(); // Reset changes
                          }}
                          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                        >
                          {t('employeeManager.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{employee.name}</h3>
                          <p className="text-gray-600">{employee.position}</p>
                          {employee.bio && (
                            <p className="text-sm text-gray-700 mt-2">{employee.bio}</p>
                          )}
                          <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                            {employee.email && (
                              <div className="flex items-center gap-1">
                                <Mail size={14} />
                                <span>{employee.email}</span>
                              </div>
                            )}
                            {employee.phone && (
                              <div className="flex items-center gap-1">
                                <Phone size={14} />
                                <span>{employee.phone}</span>
                              </div>
                            )}
                            {employee.joined_date && (
                              <div className="flex items-center gap-1">
                                <Calendar size={14} />
                                <span>{t('employeeManager.joined')} {formatDatePacific(employee.joined_date)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {!isReordering && (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              onClick={() => setEditingId(employee.id)}
                              className="p-3 sm:p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                              title="Edit employee"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(employee.id)}
                              className="p-3 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                              title="Delete employee"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                      {isReordering && (
                        <div className="absolute top-4 right-4">
                          <GripVertical size={20} className="text-gray-400" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EmployeeManager;
