/* Primitives — Icon, Ornament, Button, Eyebrow */

function Icon({ name, ...rest }) {
  // Lucide: render placeholder <i>, createIcons() swaps to <svg> after mount.
  return <i data-lucide={name} {...rest}></i>;
}

function useLucide(dep) {
  React.useEffect(() => {
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  });
}

function Ornament() {
  return (
    <div className="orn"><span className="dot"></span></div>
  );
}

/* Brand social glyphs — Lucide dropped these from core, so inline. */
const SOCIAL_PATHS = {
  instagram: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM17.8 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z",
  facebook: "M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.25-1.5 1.55-1.5h1.65V4.6c-.8-.1-1.6-.15-2.4-.15-2.4 0-4.05 1.45-4.05 4.15v2.3H7.5V14h2.75v8h3.25z",
  youtube: "M21.6 7.2a2.5 2.5 0 0 0-1.75-1.75C18.3 5 12 5 12 5s-6.3 0-7.85.45A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.75 1.75C5.7 19 12 19 12 19s6.3 0 7.85-.45a2.5 2.5 0 0 0 1.75-1.75A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3-5.2 3z",
};
function SocialGlyph({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-label={name}>
      <path d={SOCIAL_PATHS[name]}></path>
    </svg>
  );
}

function Button({ variant = "primary", size, children, icon, ...rest }) {
  const cls = ["btn", "btn-" + variant, size === "sm" ? "btn-sm" : ""].join(" ");
  return (
    <button className={cls} {...rest}>
      {children}
      {icon && <Icon name={icon} />}
    </button>
  );
}

function SectionHead({ eyebrow, title, light }) {
  return (
    <div className="head-block">
      <Ornament />
      {eyebrow && <p className="eyebrow" style={{ color: light ? "var(--gold-pale)" : "var(--gold-deep)" }}>{eyebrow}</p>}
      <h2 className="h-section" style={{
        color: light ? "var(--paper)" : "var(--ink)",
        fontSize: "clamp(30px,5vw,52px)"
      }}>{title}</h2>
    </div>
  );
}

Object.assign(window, { Icon, useLucide, Ornament, SocialGlyph, Button, SectionHead });
