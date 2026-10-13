import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useLanguage } from '../../contexts/LanguageContext';
import { announce } from '../ui/LiveRegion';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';
import { normalizeManifest, PRESET_IDS } from './designLinkManifest';
import { clearDesignLinkCaches } from './designLinkCache';
import './design-link.css';

// three.js and the scene load only once the link checks out
const DesignScene = lazy(() => import('./DesignScene'));

const API_BASE = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';
const TOKEN_RE = /^[a-f0-9]{64}$/;

// A private link from ___ (/view/:token): the client's design in
// 3D, with lighting presets, light toggles and saved views. No site
// navigation, no analytics, noindex. The API answers 404 for an unknown link,
// 410 once it has been turned off or has run out, 429 when rate limited
// (Contract C3); the page keys on the status code only.
export default function DesignLinkViewer() {
  const { token } = useParams();
  const { t } = useLanguage();
  // t is a new function every render; callbacks handed to the scene read it
  // through a ref so they stay stable
  const tRef = useRef(t);
  tRef.current = t;
  const reducedMotion = usePrefersReducedMotion();

  const [status, setStatus] = useState('loading'); // loading | ready | notFound | ended | error
  const [link, setLink] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [presetId, setPresetId] = useState(null);
  const [groupsOn, setGroupsOn] = useState({});
  const [roomId, setRoomId] = useState(null);
  // seq makes a second tap on the same view fly back to it after orbiting
  const [view, setView] = useState({ index: 0, seq: 0 });

  // An old service worker may have cached this page or its API: clear it
  useEffect(() => {
    clearDesignLinkCaches();
  }, []);

  // One fetch per mount (StrictMode mounts twice in development: the first
  // request is aborted)
  useEffect(() => {
    if (!TOKEN_RE.test(token || '')) {
      setStatus('notFound');
      return undefined;
    }
    const controller = new AbortController();
    setStatus('loading');
    (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/design-links/${token}`, {
          signal: controller.signal,
          cache: 'no-store',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
        if (response.status === 404 || response.status === 410) {
          setStatus(response.status === 404 ? 'notFound' : 'ended');
          clearDesignLinkCaches();
          return;
        }
        if (!response.ok) {
          setStatus('error');
          return;
        }
        const data = await response.json();
        const manifest = normalizeManifest(data?.manifest);
        if (!manifest || typeof data.scene_url !== 'string' || !data.scene_url.startsWith('/api/design-links/')) {
          setStatus('error');
          return;
        }
        const preset = manifest.defaultPreset;
        setLink({
          title: typeof data.title === 'string' ? data.title : '',
          price: typeof data.price_text === 'string' ? data.price_text.trim() : '',
          sceneUrl: API_BASE + data.scene_url,
          manifest,
        });
        setPresetId(preset);
        setGroupsOn(groupsFor(manifest, preset));
        setRoomId(manifest.rooms[0].id);
        setView({ index: 0, seq: 0 });
        setStatus('ready');
      } catch (err) {
        if (err?.name === 'AbortError') return;
        setStatus('error');
      }
    })();
    return () => controller.abort();
  }, [token, attempt]);

  const manifest = link?.manifest;
  const room = useMemo(
    () => manifest && (manifest.rooms.find((r) => r.id === roomId) || manifest.rooms[0]),
    [manifest, roomId],
  );

  const presetLabel = (id) => t(`designLink.preset.${id}`, manifest?.presets[id]?.label || id);

  const choosePreset = (id) => {
    setPresetId(id);
    // a preset brings its own set of lights (the client can change them after)
    setGroupsOn(groupsFor(manifest, id));
    announce(t('designLink.presetAnnounce', { name: presetLabel(id) }));
  };

  const toggleGroup = (group) => {
    const on = !groupsOn[group.id];
    setGroupsOn((prev) => ({ ...prev, [group.id]: on }));
    announce(t(on ? 'designLink.lightOn' : 'designLink.lightOff', { name: group.label }));
  };

  const chooseView = (index) => setView((prev) => ({ index, seq: prev.seq + 1 }));

  const chooseRoom = (id) => {
    setRoomId(id);
    setView((prev) => ({ index: 0, seq: prev.seq + 1 }));
  };

  const handleLoaded = useCallback(() => {
    clearDesignLinkCaches();
    announce(tRef.current('designLink.loaded'));
  }, []);

  if (status !== 'ready') {
    const card = {
      loading: null,
      notFound: { title: 'designLink.notFoundTitle', message: 'designLink.notFound' },
      ended: { title: 'designLink.endedTitle', message: 'designLink.ended' },
      error: { title: 'designLink.errorTitle', message: 'designLink.error', retry: true },
    }[status];
    return (
      <div className="design-link design-link--message">
        <Helmet>
          <title>{t('designLink.pageTitle')}</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <main id="main-content" tabIndex={-1} className="design-link__card-wrap">
          {card ? (
            <MessageCard
              title={t(card.title)}
              message={t(card.message)}
              retryLabel={card.retry ? t('designLink.retry') : null}
              onRetry={() => setAttempt((n) => n + 1)}
            />
          ) : (
            <div role="status" className="design-link__card">
              <h1 className="sr-only">{t('designLink.pageTitle')}</h1>
              <div className="design-link__spinner design-link__spinner--dark" aria-hidden="true" />
              <p>{t('designLink.loading')}</p>
            </div>
          )}
        </main>
      </div>
    );
  }

  const views = room.cameras;
  const showRooms = manifest.rooms.length > 1;
  const groups = manifest.fixtureGroups;
  const errorCard = (
    <div className="design-link__card-wrap design-link__card-wrap--overlay">
      <MessageCard
        title={t('designLink.errorTitle')}
        message={t('designLink.error')}
        retryLabel={t('designLink.retry')}
        onRetry={() => window.location.reload()}
        headingLevel={2}
      />
    </div>
  );

  return (
    <div className="design-link">
      <Helmet>
        <title>{link.title}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main id="main-content" tabIndex={-1} className="design-link__main">
        <header className="design-link__header">
          <h1 className="design-link__title">{link.title}</h1>
          {link.price ? (
            <p className="design-link__price">{t('designLink.price', { price: link.price })}</p>
          ) : null}
        </header>

        <div className="design-link__stage">
          <Suspense fallback={<SceneLoading label={t('designLink.loadingModel')} />}>
            <DesignScene
              url={link.sceneUrl}
              manifest={manifest}
              presetId={presetId}
              groupsOn={groupsOn}
              roomId={room.id}
              viewIndex={view.index}
              viewSeq={view.seq}
              reducedMotion={reducedMotion}
              onLoaded={handleLoaded}
              fallback={errorCard}
              loadingLabel={t('designLink.loadingModel')}
              canvasLabel={t('designLink.canvasLabel')}
            />
          </Suspense>
        </div>

        <nav className="design-link__controls" aria-label={t('designLink.controls')}>
          <ControlGroup label={t('designLink.lighting')}>
            {PRESET_IDS.map((id) => (
              <ToggleButton key={id} pressed={presetId === id} onClick={() => choosePreset(id)}>
                {presetLabel(id)}
              </ToggleButton>
            ))}
          </ControlGroup>

          {groups.length ? (
            <ControlGroup label={t('designLink.lights')}>
              {groups.map((g) => (
                <ToggleButton key={g.id} pressed={!!groupsOn[g.id]} onClick={() => toggleGroup(g)}>
                  {g.label}
                </ToggleButton>
              ))}
            </ControlGroup>
          ) : null}

          {views.length ? (
            <ControlGroup label={t('designLink.views')}>
              {views.map((v, i) => (
                <ToggleButton key={i} pressed={view.index === i} onClick={() => chooseView(i)}>
                  {v.name || t('designLink.viewN', { n: i + 1 })}
                </ToggleButton>
              ))}
            </ControlGroup>
          ) : null}

          {showRooms ? (
            <ControlGroup label={t('designLink.rooms')}>
              {manifest.rooms.map((r, i) => (
                <ToggleButton key={r.id} pressed={room.id === r.id} onClick={() => chooseRoom(r.id)}>
                  {r.name || t('designLink.roomN', { n: i + 1 })}
                </ToggleButton>
              ))}
            </ControlGroup>
          ) : null}
        </nav>
      </main>
    </div>
  );
}

// The preset's fixturesOn as { groupId: true/false }
function groupsFor(manifest, presetId) {
  const on = new Set(manifest.presets[presetId]?.fixturesOn || []);
  const out = {};
  manifest.fixtureGroups.forEach((g) => {
    out[g.id] = on.has(g.id);
  });
  return out;
}

function MessageCard({ title, message, retryLabel, onRetry, headingLevel = 1 }) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <div className="design-link__card">
      <Heading className="design-link__card-title">{title}</Heading>
      <p>{message}</p>
      {retryLabel ? (
        <button type="button" className="design-link__button design-link__button--primary" onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

function SceneLoading({ label }) {
  return (
    <div className="design-link__loading" role="status">
      <div className="design-link__spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

function ControlGroup({ label, children }) {
  return (
    <div className="design-link__group" role="group" aria-label={label}>
      <span className="design-link__group-label" aria-hidden="true">{label}</span>
      <div className="design-link__group-buttons">{children}</div>
    </div>
  );
}

function ToggleButton({ pressed, onClick, children }) {
  return (
    <button
      type="button"
      className="design-link__button"
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
