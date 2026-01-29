import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  CheckCircle,
  Circle,
  PlayCircle,
  Clock,
  Calendar,
  FileText,
  Image as ImageIcon,
  RefreshCw
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import Navigation from '../ui/Navigation';
import Footer from '../ui/Footer';
import SEO from '../ui/SEO';

const API_BASE = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';

const ProjectTimeline = () => {
  const { token } = useParams();
  const { t, changeLanguage } = useLanguage();
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (token) {
      loadTimeline();
    }
  }, [token]);

  // Set language based on timeline
  useEffect(() => {
    if (timeline && timeline.client_language) {
      changeLanguage(timeline.client_language);
    }
  }, [timeline]);

  const loadTimeline = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/timeline/${token}`);

      if (response.ok) {
        const data = await response.json();
        setTimeline(data);
      } else {
        setError('Timeline not found or access denied');
      }
    } catch (err) {
      console.error('Error loading timeline:', err);
      setError('Failed to load timeline');
    } finally {
      setLoading(false);
    }
  };

  // Phase name translations
  const getPhaseLabel = (phaseKey) => {
    return t(`timeline.phases.${phaseKey}`) || phaseKey;
  };

  // Get phase status label
  const getStatusLabel = (status) => {
    return t(`timeline.status.${status}`) || status;
  };

  // Status icon and style
  const getStatusStyle = (status) => {
    const styles = {
      pending: {
        icon: Circle,
        color: '#6B7280',
        bg: '#F3F4F6',
        iconBg: '#9CA3AF'
      },
      in_progress: {
        icon: PlayCircle,
        color: '#2563EB',
        bg: '#DBEAFE',
        iconBg: '#3B82F6'
      },
      completed: {
        icon: CheckCircle,
        color: '#059669',
        bg: '#D1FAE5',
        iconBg: '#10B981'
      }
    };
    return styles[status] || styles.pending;
  };

  // Calculate progress percentage
  const getProgress = () => {
    if (!timeline || !timeline.phases) return 0;
    const completed = timeline.phases.filter(p => p.status === 'completed').length;
    return Math.round((completed / timeline.phases.length) * 100);
  };

  // Phase component
  const PhaseCard = ({ phase, index, isLast }) => {
    const style = getStatusStyle(phase.status);
    const Icon = style.icon;

    return (
      <div style={{ position: 'relative', paddingLeft: '3rem' }}>
        {/* Timeline connector */}
        {!isLast && (
          <div style={{
            position: 'absolute',
            left: '1.25rem',
            top: '3rem',
            bottom: '-2rem',
            width: '2px',
            background: phase.status === 'completed' ? style.iconBg : '#E5E7EB'
          }} />
        )}

        {/* Phase icon */}
        <div style={{
          position: 'absolute',
          left: '0',
          top: '0.5rem',
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: '50%',
          background: style.iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '3px solid white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <Icon size={18} color="white" />
        </div>

        {/* Phase content */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: `2px solid ${style.bg}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                {getPhaseLabel(phase.phase_name_key)}
              </h3>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                background: style.bg,
                color: style.color,
                fontSize: '0.875rem',
                fontWeight: '500'
              }}>
                {getStatusLabel(phase.status)}
              </span>
            </div>
          </div>

          {/* Dates */}
          {(phase.start_date || phase.estimated_completion || phase.actual_completion) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {phase.start_date && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#6B7280' }}>
                  <Calendar size={16} />
                  <span><strong>{t('timeline.started')}:</strong> {new Date(phase.start_date).toLocaleDateString()}</span>
                </div>
              )}

              {phase.estimated_completion && phase.status !== 'completed' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#6B7280' }}>
                  <Clock size={16} />
                  <span><strong>{t('timeline.estimated')}:</strong> {new Date(phase.estimated_completion).toLocaleDateString()}</span>
                </div>
              )}

              {phase.actual_completion && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#059669' }}>
                  <CheckCircle size={16} />
                  <span><strong>{t('timeline.completed')}:</strong> {new Date(phase.actual_completion).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {phase.notes && (
            <div style={{
              padding: '1rem',
              background: '#F9FAFB',
              borderRadius: '8px',
              marginTop: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#6B7280' }}>
                <FileText size={16} />
                <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{t('timeline.notes')}:</span>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#374151', whiteSpace: 'pre-wrap' }}>
                {phase.notes}
              </p>
            </div>
          )}

          {/* Photos */}
          {phase.photos && phase.photos.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#6B7280' }}>
                <ImageIcon size={16} />
                <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{t('timeline.photos')}:</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
                {phase.photos.map((photo, idx) => (
                  <img
                    key={idx}
                    src={`${API_BASE}${photo}`}
                    alt={`${getPhaseLabel(phase.phase_name_key)} photo ${idx + 1}`}
                    style={{
                      width: '100%',
                      height: '150px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                    onClick={() => window.open(`${API_BASE}${photo}`, '_blank')}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <>
        <Navigation />
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' }}>
          <div style={{ textAlign: 'center' }}>
            <RefreshCw size={48} className="animate-spin" style={{ margin: '0 auto', color: '#6B7280' }} />
            <p style={{ marginTop: '1rem', color: '#6B7280' }}>{t('timeline.loading')}</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navigation />
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' }}>
          <div style={{ textAlign: 'center', maxWidth: '500px', padding: '2rem' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: '#FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem'
            }}>
              <FileText size={40} color="#DC2626" />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{t('timeline.error')}</h1>
            <p style={{ color: '#6B7280' }}>{error}</p>
          </div>
        </div>
      </>
    );
  }

  const progress = getProgress();

  return (
    <>
      <SEO
        title={t('timeline.title')}
        description={t('timeline.description')}
      />
      <Navigation />

      <div style={{ minHeight: '100vh', background: '#F9FAFB', padding: '3rem 1rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            marginBottom: '2rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
          }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              {t('timeline.yourProject')}
            </h1>
            <p style={{ color: '#6B7280', marginBottom: '1.5rem' }}>
              {t('timeline.trackProgress')}
            </p>

            {/* Progress bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  {t('timeline.overallProgress')}
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#2563EB' }}>
                  {progress}%
                </span>
              </div>
              <div style={{ height: '12px', background: '#E5E7EB', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #3B82F6, #2563EB)',
                  transition: 'width 0.5s ease',
                  borderRadius: '9999px'
                }} />
              </div>
            </div>
          </div>

          {/* Timeline phases */}
          <div>
            {timeline.phases && timeline.phases.map((phase, index) => (
              <PhaseCard
                key={phase.id}
                phase={phase}
                index={index}
                isLast={index === timeline.phases.length - 1}
              />
            ))}
          </div>

          {/* Footer note */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>
              {t('timeline.updateNote')}
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ProjectTimeline;
