export function Icon({ name, size = 18, ...props }) {
  const paths = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    check: <path d="m5 12 4 4L19 6" />,
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="3" />
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      </>
    ),
    code: (
      <>
        <path d="m7 7-5 5 5 5m10-10 5 5-5 5m-4-14-2 18" />
      </>
    ),
    nodes: (
      <>
        <circle cx="6" cy="6" r="3" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="12" cy="18" r="3" />
        <path d="m7.5 9 3 6m6-6-3 6M9 6h6" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v5c0 5-8 10-8 10S4 16 4 11V6l8-3Z" />
        <path d="m8 11 3 3 5-5" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    settings: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="8" cy="6" r="2" />
        <circle cx="16" cy="12" r="2" />
        <circle cx="10" cy="18" r="2" />
      </>
    ),
    external: (
      <>
        <path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    qr: (
      <>
        <path d="M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM20 14v4h-3v3m3 0h1" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10v1" />
      </>
    ),
    github: (
      <>
        <path
          d="M9 19c-5 1-5-3-7-3m14 6v-4a3.5 3.5 0 0 0-1-2.5c3.3-.4 6.8-1.6 6.8-7.3A5.7 5.7 0 0 0 20.2 4a5.3 5.3 0 0 0-.1-4S18.8-.4 16 1.5a15.4 15.4 0 0 0-8 0C5.2-.4 3.9 0 3.9 0a5.3 5.3 0 0 0-.1 4 5.7 5.7 0 0 0-1.6 4.2c0 5.7 3.5 6.9 6.8 7.3A3.5 3.5 0 0 0 8 18v4"
          transform="translate(1 2) scale(.9)"
        />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    moon: <path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z" />,
    auto: (
      <>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8m-4-4v4" />
      </>
    ),
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] || paths.nodes}
    </svg>
  )
}

export function LogoMark() {
  return (
    <svg
      className="logo-mark"
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 27 12 9l6 12 6-12 7 18"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="27" r="2" fill="currentColor" />
    </svg>
  )
}

export function StepBadge({ n }) {
  return <span className="step-badge">{String(n).padStart(2, '0')}</span>
}
export function Card({ children, className = '', ...props }) {
  return (
    <section className={`panel ${className}`} {...props}>
      {children}
    </section>
  )
}
export function CardHeader({ children }) {
  return <div className="panel-header">{children}</div>
}
export const secBtnCls = 'button secondary'
export const inputCls = 'text-input'

// A shared visual motif: inputs converge, then become an exportable configuration.
export function SignalGraphic({ active = false, loading = false }) {
  return (
    <div
      className={`signal-graphic ${active ? 'is-active' : ''} ${loading ? 'is-processing' : ''}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 400 190" fill="none">
        <path
          className="signal-grid"
          d="M0 35h400M0 75h400M0 115h400M0 155h400M40 0v190M80 0v190M120 0v190M160 0v190M200 0v190M240 0v190M280 0v190M320 0v190M360 0v190"
        />
        <circle className="signal-orbit" cx="218" cy="95" r="72" />
        <circle className="signal-orbit" cx="218" cy="95" r="53" />
        <g className="signal-path">
          <path d="M43 42h57c42 0 31 53 78 53M43 95h135M43 148h57c42 0 31-53 78-53M258 95h93" />
        </g>
        <g className="signal-flow">
          <path d="M43 42h57c42 0 31 53 78 53M43 95h135M43 148h57c42 0 31-53 78-53M258 95h93" />
        </g>
        {[42, 95, 148].map((y) => (
          <g key={y}>
            <rect
              className="signal-node"
              x="27"
              y={y - 12}
              width="30"
              height="24"
              rx="7"
            />
            <circle cx="42" cy={y} r="3" fill="currentColor" />
          </g>
        ))}
        <rect
          className="signal-core"
          x="178"
          y="55"
          width="80"
          height="80"
          rx="23"
        />
        <path
          d="m192 107 10-25 16 22 13-22 12 25"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <rect
          className="signal-node"
          x="336"
          y="78"
          width="32"
          height="34"
          rx="7"
        />
        <path
          d="M345 88h14m-14 7h14m-14 7h8"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  )
}
