import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Image as ImageIcon, CheckCircle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import Navigation from '../ui/Navigation';
import Footer from '../ui/Footer';
import '../css/testimonial-form.css';
import { color } from 'three/src/nodes/TSL.js';

const QuickContactForm = ({ onBack }) => {
  const navigate = useNavigate();
  const { currentLanguage, t } = useLanguage();

  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    project_type: '',
    room_dimensions: '',
    budget_range: '',
    preferred_materials: '',
    preferred_colors: '',
    message: '',
  });

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const API_BASE = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';

  // Budget range options
  const budgetRanges = {
    en: [
      { value: '', label: 'Select a range...' },
      { value: 'under_5k', label: 'Under $5,000' },
      { value: '5k_10k', label: '$5,000 - $10,000' },
      { value: '10k_25k', label: '$10,000 - $25,000' },
      { value: '25k_50k', label: '$25,000 - $50,000' },
      { value: 'over_50k', label: 'Over $50,000' },
      { value: 'not_sure', label: 'Not sure yet' },
    ],
    es: [
      { value: '', label: 'Seleccione un rango...' },
      { value: 'under_5k', label: 'Menos de $5,000' },
      { value: '5k_10k', label: '$5,000 - $10,000' },
      { value: '10k_25k', label: '$10,000 - $25,000' },
      { value: '25k_50k', label: '$25,000 - $50,000' },
      { value: 'over_50k', label: 'Más de $50,000' },
      { value: 'not_sure', label: 'No estoy seguro todavía' },
    ],
  };

  // Project type options
  const projectTypes = {
    en: [
      { value: '', label: 'Select project type...' },
      { value: 'new-construction', label: 'New Construction' },
      { value: 'remodel', label: 'Remodel' },
      { value: 'addition', label: 'Addition' },
    ],
    es: [
      { value: '', label: 'Seleccione tipo de proyecto...' },
      { value: 'new-construction', label: 'Nueva Construcción' },
      { value: 'remodel', label: 'Remodelación' },
      { value: 'addition', label: 'Adición' },
    ],
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const maxFiles = 5;
    const maxFileSize = 10 * 1024 * 1024; // 10MB

    if (selectedFiles.length + files.length > maxFiles) {
      setError(
        currentLanguage === 'es'
          ? `Solo puede cargar hasta ${maxFiles} fotos.`
          : `You can only upload up to ${maxFiles} photos.`
      );
      return;
    }

    const validFiles = files.filter((file) => {
      if (!file.type.startsWith('image/')) {
        setError(
          currentLanguage === 'es'
            ? 'Por favor, cargue solo archivos de imagen.'
            : 'Please only upload image files.'
        );
        return false;
      }
      if (file.size > maxFileSize) {
        setError(
          currentLanguage === 'es'
            ? 'Cada archivo debe ser menor de 10MB.'
            : 'Each file must be less than 10MB.'
        );
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setSelectedFiles((prev) => [...prev, ...validFiles]);

    // Create preview URLs
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrls((prev) => [...prev, e.target.result]);
      };
      reader.readAsDataURL(file);
    });

    setError('');
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate required fields
    if (!formData.client_name || !formData.client_email || !formData.project_type) {
      setError(
        currentLanguage === 'es'
          ? 'Por favor complete todos los campos requeridos.'
          : 'Please fill in all required fields.'
      );
      setLoading(false);
      return;
    }

    try {
      const formDataWithFiles = new FormData();
      formDataWithFiles.append('client_name', formData.client_name);
      formDataWithFiles.append('client_email', formData.client_email);
      formDataWithFiles.append('client_phone', formData.client_phone);
      formDataWithFiles.append('client_language', currentLanguage);
      formDataWithFiles.append('project_type', formData.project_type);
      formDataWithFiles.append('room_dimensions', formData.room_dimensions);
      formDataWithFiles.append('budget_range', formData.budget_range);
      formDataWithFiles.append('preferred_materials', formData.preferred_materials);
      formDataWithFiles.append('preferred_colors', formData.preferred_colors);
      formDataWithFiles.append('message', formData.message);

      // Add photos
      selectedFiles.forEach((file) => {
        formDataWithFiles.append('photos', file);
      });

      const response = await fetch(`${API_BASE}/api/contact/quick-quote`, {
        method: 'POST',
        body: formDataWithFiles,
      });

      if (response.ok) {
        setSubmitted(true);
        // Scroll to top to show success message
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const errorData = await response.json();
        setError(errorData.error || (currentLanguage === 'es'
          ? 'Error al enviar la solicitud. Por favor intente nuevamente.'
          : 'Failed to submit request. Please try again.'));
      }
    } catch (error) {
      console.error('Error submitting quote request:', error);
      setError(
        currentLanguage === 'es'
          ? 'Error al enviar la solicitud. Por favor intente nuevamente.'
          : 'Failed to submit request. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "rgb(110,110,110)" }}>
        <Navigation />
        <div className="testimonial-container">
          <div className="testimonial-form-card">
            <CheckCircle className="success-icon" />
            <h2>
              {currentLanguage === 'es'
                ? '¡Solicitud Enviada!'
                : 'Request Submitted!'}
            </h2>
            <p>
              {currentLanguage === 'es'
                ? 'Gracias por su interés en Gudino Custom Woodworking. Nos pondremos en contacto con usted dentro de 2-4 días hábiles.'
                : 'Thank you for your interest in Gudino Custom Woodworking. We will contact you within 2-4 business days.'}
            </p>
            <p className="text-sm text-gray-600 mt-4">
              {currentLanguage === 'es'
                ? 'Hemos enviado un correo electrónico de confirmación a su dirección de correo.'
                : 'We have sent a confirmation email to your email address.'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="btn-primary mt-4"
            >
              {currentLanguage === 'es' ? 'Volver al Inicio' : 'Return to Home'}
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "rgb(110,110,110)", paddingBottom: "2rem" }}>
      <Navigation />
      <div style={{ height: "2vh" }}></div>
      <div className="testimonial-container">
        <div className="testimonial-form-card">
          <h2 className="testimonial-form-title text-4xl mb-6">
            {currentLanguage === 'es'
              ? 'Solicitar Cotización'
              : 'Request a Quote'}
          </h2>
          <p className="text-lg text-gray-600 mb-10">
            {currentLanguage === 'es'
              ? 'Complete este formulario y nos pondremos en contacto con usted para discutir su proyecto.'
              : 'Fill out this form and we will contact you to discuss your project.'}
          </p>

          {error && (
            <div className="error-message" style={{ marginBottom: '1.5rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="testimonial-form">
            {/* Contact Information */}
            <div className="form-section mb-10">
              <h3 className="section-title text-2xl my-6">
                <strong style={{color:'black' ,important: true}}>
                  {currentLanguage === 'es'
                    ? 'Información de Contacto'
                    : 'Contact Information'}
                </strong>
              </h3>

              <div className="form-group mb-6">
                <label htmlFor="client_name" className="form-label text-base mb-2 block">
                  {currentLanguage === 'es' ? 'Nombre Completo' : 'Full Name'} *
                </label>
                <input
                  type="text"
                  id="client_name"
                  name="client_name"
                  value={formData.client_name}
                  onChange={handleInputChange}
                  className="form-input text-base py-3"
                  required
                  placeholder='Enter Your Full Name'
                />
              </div>

              <div className="form-group mb-6">
                <label htmlFor="client_email" className="form-label text-base mb-2 block">
                  {currentLanguage === 'es' ? 'Correo Electrónico' : 'Email'} *
                </label>
                <input
                  type="email"
                  id="client_email"
                  name="client_email"
                  value={formData.client_email}
                  onChange={handleInputChange}
                  className="form-input text-base py-3"
                  required
                  placeholder='Enter Your Email'
                />
              </div>

              <div className="form-group mb-6">
                <label htmlFor="client_phone" className="form-label text-base mb-2 block">
                  {currentLanguage === 'es' ? 'Teléfono' : 'Phone'} *
                </label>
                <input
                  type="tel"
                  id="client_phone"
                  name="client_phone"
                  value={formData.client_phone}
                  onChange={handleInputChange}
                  required
                  className="form-input text-base py-3"
                  placeholder="Enter Your Phone Number"
                />
              </div>
            </div>

            {/* Project Details */}
            <div className="form-section mb-10">
              <h3 className="section-title text-2xl my-6">
                <strong style={{color:'black' ,important: true}}>
                  {currentLanguage === 'es'
                  ? 'Detalles del Proyecto'
                  : 'Project Details'}
                  </strong>
              </h3>

              <div className="form-group mb-6">
                <label htmlFor="project_type" className="form-label text-base mb-2 block">
                  {currentLanguage === 'es' ? 'Tipo de Proyecto' : 'Project Type'} *
                </label>
                <select
                  id="project_type"
                  name="project_type"
                  value={formData.project_type}
                  onChange={handleInputChange}
                  className="form-input text-base py-3"
                  required
                >
                  {projectTypes[currentLanguage].map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group mb-6">
                <label htmlFor="message" className="form-label text-base mb-2 block">
                  {currentLanguage === 'es'
                    ? 'Mensaje Adicional'
                    : 'Additional Message'}
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  className="form-input text-base py-3"
                  rows="6"
                  placeholder={
                    currentLanguage === 'es'
                      ? 'Cuéntenos más sobre su proyecto...'
                      : 'Tell us more about your project...'
                  }
                />
              </div>
            </div>

            {/* Inspiration Photos */}
            <div className="form-group mb-10">
              <h3 className="section-title text-2xl my-6">
                <strong style={{color:'black' ,important: true}}>
                  {currentLanguage === 'es'
                    ? 'Fotos de Inspiración (Opcional)'
                    : 'Inspiration Photos (Optional)'}
                </strong>
              </h3>
              <p className="text-base text-gray-600 mb-6">
                {currentLanguage === 'es'
                  ? 'Cargue hasta 5 fotos que le inspiren para su proyecto (máx. 10MB cada una)'
                  : 'Upload up to 5 photos that inspire you for your project (max 10MB each)'}
              </p>

              <div className="photo-upload-area">
                <input
                  type="file"
                  id="photos"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="file-input-hidden"
                  disabled={selectedFiles.length >= 5}
                />
                <label
                  htmlFor="photos"
                  className={`file-upload-label ${
                    selectedFiles.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Upload className="upload-icon" />
                  <span>
                    {currentLanguage === 'es'
                      ? 'Haga clic para cargar fotos'
                      : 'Click to upload photos'}
                  </span>
                  <span className="text-sm text-gray-500">
                    {currentLanguage === 'es'
                      ? `${selectedFiles.length}/5 fotos cargadas`
                      : `${selectedFiles.length}/5 photos uploaded`}
                  </span>
                </label>
              </div>

              {previewUrls.length > 0 && (
                <div className="photo-preview-grid">
                  {previewUrls.map((url, index) => (
                    <div key={index} className="photo-preview-item">
                      <img src={url} alt={`Preview ${index + 1}`} />
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="remove-photo-button"
                        aria-label="Remove photo"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-actions mt-8">
              <button
                type="button"
                onClick={() => onBack ? onBack() : navigate('/')}
                className="btn-primary text-base py-3 px-6"
                disabled={loading}
              >
                {currentLanguage === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button type="submit" className="btn-primary text-base py-3 px-6 my-2" disabled={loading}>
                {loading
                  ? currentLanguage === 'es'
                    ? 'Enviando...'
                    : 'Submitting...'
                  : currentLanguage === 'es'
                  ? 'Enviar Solicitud'
                  : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default QuickContactForm;
