import React from 'react';
import ReactDOM from 'react-dom';
import { ICONS } from '../icons.js';
import { cx, fmtPP, fmtAge, fmtTimeSec, fmtSignedCents } from '../lib/format.js';
import { useFocusTrap, useDismiss, useStableId } from '../lib/hooks.js';
import { useStore } from '../store.jsx';

const { useRef, useState, forwardRef } = React;

// ---------------------------------------------------------------- Icon (Lucide outline)
function renderNode(node, key) {
  const [tag, attr, children] = node;
  return React.createElement(tag, { key, ...attr }, children ? children.map(renderNode) : undefined);
}
export function Icon({ n, size = 18, className, title, strokeWidth = 1.75, style }) {
  const nodes = ICONS[n];
  if (!nodes) { console.warn('Missing icon:', n); return null; }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={cx('icon', className)} style={style}
      aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined} focusable="false">
      {title ? <title>{title}</title> : null}
      {nodes.map(renderNode)}
    </svg>
  );
}

// ---------------------------------------------------------------- Brand
export function LogoMark({ size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="logo-mark" focusable="false">
      <rect x="1.25" y="1.25" width="21.5" height="21.5" rx="5.5" fill="var(--accent-subtle)" stroke="var(--accent)" strokeWidth="1.5" />
      <path d="M7.25 10.25v7M12 6.25v7.5M16.75 9.25v5.5" stroke="var(--accent)" strokeWidth="2.1" strokeLinecap="round" fill="none" />
    </svg>
  );
}
export function Logo({ href = '#home', size = 24, label = 'Banthom home', hideWord = false }) {
  return (
    <a href={href} className="logo" aria-label={label}>
      <LogoMark size={size} />
      {!hideWord && <span className="logo-word" aria-hidden="true">Banthom</span>}
    </a>
  );
}

// ---------------------------------------------------------------- Buttons
const iconSize = { xs: 14, sm: 16, md: 18, lg: 20 };
export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, children, className, href, loading, block, ...rest }, ref,
) {
  const cls = cx('btn', `btn-${variant}`, `btn-${size}`, block && 'btn-block', loading && 'is-loading', className);
  const content = (
    <>
      {loading ? <span className="spinner" aria-hidden="true" /> : icon ? <Icon n={icon} size={iconSize[size]} /> : null}
      {children != null && <span className="btn-label">{children}</span>}
      {iconRight ? <Icon n={iconRight} size={iconSize[size] - 2} /> : null}
    </>
  );
  if (href) return <a ref={ref} href={href} className={cls} {...rest}>{content}</a>;
  return <button ref={ref} type="button" className={cls} aria-busy={loading || undefined} {...rest}>{content}</button>;
});

export const IconButton = forwardRef(function IconButton(
  { icon, label, size = 'md', variant = 'ghost', tip = true, tipPos, className, badge, ...rest }, ref,
) {
  return (
    <button ref={ref} type="button" aria-label={label} data-tip={tip ? label : undefined} data-tip-pos={tipPos}
      className={cx('btn', `btn-${variant}`, `btn-${size}`, 'btn-icon', className)} {...rest}>
      <Icon n={icon} size={iconSize[size]} />
      {badge ? <span className="btn-badge" aria-hidden="true">{badge}</span> : null}
    </button>
  );
});

// ---------------------------------------------------------------- Badges and status
export function Badge({ tone = 'neutral', icon, children, className, tip, size, ...rest }) {
  return (
    <span className={cx('badge', `badge-${tone}`, size && `badge-${size}`, className)} data-tip={tip} tabIndex={tip ? 0 : undefined} {...rest}>
      {icon && <Icon n={icon} size={12} strokeWidth={2} />}
      <span>{children}</span>
    </span>
  );
}

// Live venues shown in Banthom.
export const VENUE_INFO = { kalshi: { code: 'KAL', name: 'Kalshi' }, polymarket: { code: 'PM', name: 'Polymarket' } };
export function VenueBadge({ venue, full }) {
  const v = VENUE_INFO[venue] || { code: String(venue || '?').slice(0, 3).toUpperCase(), name: String(venue || 'Unknown venue') };
  return (
    <span className={cx('venue', `venue-live-${venue}`)} data-tip={full ? undefined : v.name}>
      <span className="venue-code" aria-hidden={full ? undefined : 'true'}>{v.code}</span>
      {full ? <span className="venue-name">{v.name}</span> : <span className="sr-only">{v.name}</span>}
    </span>
  );
}

export function Delta({ value, unit = 'pp', digits = 1, className, size }) {
  if (value == null || Number.isNaN(value)) return <span className={cx('delta', 'delta-none', className)} data-tip="Not available">—</span>;
  const r = Number(value.toFixed(digits));
  const dir = r > 0 ? 'up' : r < 0 ? 'down' : 'flat';
  const text = unit === 'pp' ? fmtPP(r, digits) : fmtSignedCents(r, digits);
  return (
    <span className={cx('delta', `delta-${dir}`, size && `delta-${size}`, className)}>
      <Icon n={dir === 'up' ? 'arrow-up-right' : dir === 'down' ? 'arrow-down-right' : 'minus'} size={size === 'lg' ? 16 : 13} strokeWidth={2.25} />
      <span>{text}</span>
    </span>
  );
}

export function InfoTip({ text, label = 'More information', pos }) {
  return (
    <button type="button" className="info-tip" aria-label={`${label}: ${text}`} data-tip={text} data-tip-pos={pos}>
      <Icon n="info" size={14} />
    </button>
  );
}

export function Kbd({ children }) { return <kbd className="kbd">{children}</kbd>; }

// ---------------------------------------------------------------- Tabs (ARIA tabs pattern)
export function Tabs({ tabs, value, onChange, label, className, idBase, size }) {
  const refs = useRef([]);
  const onKey = (e, i) => {
    let j = null;
    if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = tabs.length - 1;
    if (j != null) { e.preventDefault(); onChange(tabs[j].id); refs.current[j] && refs.current[j].focus(); }
  };
  return (
    <div role="tablist" aria-label={label} className={cx('tabs', size && `tabs-${size}`, className)}>
      {tabs.map((t, i) => (
        <button key={t.id} ref={(el) => { refs.current[i] = el; }} role="tab" type="button"
          id={`${idBase}-tab-${t.id}`} aria-controls={`${idBase}-panel-${t.id}`} aria-selected={value === t.id}
          tabIndex={value === t.id ? 0 : -1} className="tab" onClick={() => onChange(t.id)} onKeyDown={(e) => onKey(e, i)}>
          {t.icon && <Icon n={t.icon} size={16} />}
          <span>{t.label}</span>
          {t.count != null && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function TabPanel({ idBase, id, value, children, className }) {
  if (value !== id) return null;
  return (
    <div role="tabpanel" id={`${idBase}-panel-${id}`} aria-labelledby={`${idBase}-tab-${id}`} className={className} tabIndex={0}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- Segmented control (radio group)
export function Segmented({ options, value, onChange, label, size = 'sm', className }) {
  const refs = useRef([]);
  const onKey = (e, i) => {
    let j = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + options.length) % options.length;
    if (j != null) { e.preventDefault(); onChange(options[j].id); refs.current[j] && refs.current[j].focus(); }
  };
  return (
    <div role="radiogroup" aria-label={label} className={cx('seg', `seg-${size}`, className)}>
      {options.map((o, i) => (
        <button key={o.id} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={value === o.id}
          tabIndex={value === o.id ? 0 : -1} className="seg-opt" onClick={() => onChange(o.id)} onKeyDown={(e) => onKey(e, i)}
          aria-label={o.aria} data-tip={o.tip}>
          {o.icon && <Icon n={o.icon} size={14} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, id, hint, disabled }) {
  const sid = useStableId('sw');
  const realId = id || sid;
  return (
    <div className={cx('switch-row', disabled && 'is-disabled')}>
      <div className="switch-text">
        <label htmlFor={realId} className="switch-label">{label}</label>
        {hint && <p className="switch-hint" id={realId + '-hint'}>{hint}</p>}
      </div>
      <button id={realId} type="button" role="switch" aria-checked={!!checked} disabled={disabled}
        aria-describedby={hint ? realId + '-hint' : undefined} className="switch" onClick={() => onChange(!checked)}>
        <span className="switch-thumb" />
      </button>
    </div>
  );
}

export function Check({ checked, onChange, label, id, disabled, hint }) {
  const sid = useStableId('ck');
  const realId = id || sid;
  return (
    <div className={cx('check', disabled && 'is-disabled')}>
      <input type="checkbox" id={realId} checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hint ? realId + '-hint' : undefined} />
      <label htmlFor={realId}>
        <span className="check-box" aria-hidden="true"><Icon n="check" size={12} strokeWidth={3} /></span>
        <span className="check-text"><span>{label}</span>{hint && <span className="check-hint" id={realId + '-hint'}>{hint}</span>}</span>
      </label>
    </div>
  );
}

// ---------------------------------------------------------------- Overlays
export function Sheet({ open, onClose, title, sub, side = 'right', children, footer, width = 440, className }) {
  const ref = useRef(null);
  const hid = useStableId('sheet');
  useFocusTrap(ref, open, onClose);
  if (!open) return null;
  return ReactDOM.createPortal(
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={hid} className={cx('sheet', `sheet-${side}`, className)}
        style={{ '--sheet-w': `${width}px` }} tabIndex={-1}>
        <header className="sheet-head">
          <div>
            <h2 id={hid} className="sheet-title">{title}</h2>
            {sub && <p className="sheet-sub">{sub}</p>}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} tipPos="left" />
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function Popover({ open, onClose, anchorRef, children, align = 'start', className, label, role = 'dialog', width }) {
  const ref = useRef(null);
  useDismiss([ref, anchorRef], open, onClose);
  if (!open) return null;
  return (
    <div ref={ref} className={cx('popover', `popover-${align}`, className)} role={role} aria-label={label} style={width ? { width } : undefined}>
      {children}
    </div>
  );
}

// Menu button with arrow-key navigation (ARIA menu button pattern).
export function MenuButton({ label, icon = 'ellipsis', items, align = 'end', size = 'sm', triggerLabel, variant = 'ghost' }) {
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  const listRef = useRef(null);
  const focusItem = (i) => {
    const els = listRef.current ? [...listRef.current.querySelectorAll('[role="menuitem"]:not([disabled])')] : [];
    if (els.length) els[(i + els.length) % els.length].focus();
  };
  const onKey = (e) => {
    const els = [...listRef.current.querySelectorAll('[role="menuitem"]:not([disabled])')];
    const i = els.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(i + 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(i - 1); }
    if (e.key === 'Escape') { setOpen(false); btn.current && btn.current.focus(); }
    if (e.key === 'Tab') setOpen(false);
  };
  return (
    <div className="pop-wrap">
      {triggerLabel ? (
        <Button ref={btn} variant={variant} size={size} icon={icon} iconRight="chevron-down" aria-haspopup="menu" aria-expanded={open}
          onClick={() => { setOpen((o) => !o); setTimeout(() => focusItem(0), 20); }}>{triggerLabel}</Button>
      ) : (
        <IconButton ref={btn} icon={icon} label={label} size={size} variant={variant} aria-haspopup="menu" aria-expanded={open}
          onClick={() => { setOpen((o) => !o); setTimeout(() => focusItem(0), 20); }} />
      )}
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btn} align={align} role="presentation" className="menu-pop">
        <div ref={listRef} role="menu" aria-label={label || triggerLabel} onKeyDown={onKey} className="menu">
          {items.map((it, i) => (it.sep ? <div key={i} role="separator" className="menu-sep" /> : (
            <button key={i} type="button" role="menuitem" className={cx('menu-item', it.danger && 'is-danger')} disabled={it.disabled}
              title={it.disabledReason} onClick={() => { setOpen(false); it.onClick && it.onClick(); btn.current && btn.current.focus(); }}>
              {it.icon && <Icon n={it.icon} size={16} />}
              <span className="menu-item-text">{it.label}{it.disabledReason && <span className="menu-item-hint">{it.disabledReason}</span>}</span>
            </button>
          )))}
        </div>
      </Popover>
    </div>
  );
}

export function Toaster() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={cx('toast', `toast-${t.tone}`)}>
          <Icon n={t.tone === 'error' ? 'circle-alert' : t.tone === 'info' ? 'info' : 'circle-check'} size={18} />
          <span className="toast-msg">{t.message}</span>
          {t.action && (
            <button type="button" className="toast-action" onClick={() => { t.action.onClick(); dismissToast(t.id); }}>{t.action.label}</button>
          )}
          <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={() => dismissToast(t.id)}>
            <Icon n="x" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Layout pieces
export function Panel({ title, sub, actions, children, className, id, as: Tag = 'section', bodyClass, level = 2, flush, footer }) {
  const hid = id ? `${id}-title` : undefined;
  const H = `h${level}`;
  return (
    <Tag className={cx('panel', className)} aria-labelledby={title ? hid : undefined} id={id}>
      {(title || actions) && (
        <div className="panel-head">
          <div className="panel-titles">
            {title && React.createElement(H, { className: 'panel-title', id: hid }, title)}
            {sub && <p className="panel-sub">{sub}</p>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      <div className={cx('panel-body', flush && 'is-flush', bodyClass)}>{children}</div>
      {footer && <div className="panel-foot">{footer}</div>}
    </Tag>
  );
}

export function EmptyState({ title, children, action, compact }) {
  return (
    <div className={cx('empty', compact && 'empty-compact')}>
      <p className="empty-title">{title}</p>
      {children && <p className="empty-body">{children}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function Banner({ tone = 'warning', icon, title, children, actions, className }) {
  return (
    <div className={cx('banner', `banner-${tone}`, className)} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon n={icon || (tone === 'warning' ? 'triangle-alert' : tone === 'danger' ? 'circle-alert' : 'info')} size={18} />
      <div className="banner-text">
        {title && <strong>{title}</strong>} {children}
      </div>
      {actions && <div className="banner-actions">{actions}</div>}
    </div>
  );
}

export function Field({ id, label, hint, error, children, optional, className }) {
  return (
    <div className={cx('field', error && 'has-error', className)}>
      <label htmlFor={id} className="field-label">{label}{optional && <span className="field-opt"> (optional)</span>}</label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="field-error"><Icon n="circle-alert" size={14} />{error}</p>
      ) : hint ? <p id={`${id}-hint`} className="field-hint">{hint}</p> : null}
    </div>
  );
}
export const describedBy = (id, hint, error) => (error ? `${id}-err` : hint ? `${id}-hint` : undefined);

export function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="crumbs">
      <ol>
        {items.map((it, i) => (
          <li key={i}>
            {it.href && i < items.length - 1 ? <a href={it.href}>{it.label}</a> : <span aria-current={i === items.length - 1 ? 'page' : undefined}>{it.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({ title, sub, actions, crumbs, meta, children }) {
  return (
    <header className="page-head">
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="page-head-row">
        <div className="page-head-text">
          <h1 className="page-title" tabIndex={-1} data-route-focus>{title}</h1>
          {sub && <p className="page-sub">{sub}</p>}
          {meta && <div className="page-meta">{meta}</div>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function Skeleton({ h = 16, w = '100%', r }) {
  return <span className="skeleton" style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />;
}

export function KeyValue({ items, className }) {
  return (
    <dl className={cx('kv', className)}>
      {items.map(([k, v, tip], i) => (
        <div className="kv-row" key={i}>
          <dt>{k}{tip && <InfoTip text={tip} label={k} />}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
