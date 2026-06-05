/* Page sections — NavBar, Hero, Intro, Team, Gallery, Visit, Footer */

const TEAM = [
  { name: "Avraz", role: "Barbier", img: "../../assets/team-avraz.jpg" },
  { name: "Adil",  role: "Barbier", img: "../../assets/team-adil.jpg" },
  { name: "Simar", role: "Barbier", img: "../../assets/team-simar.jpg" },
  { name: "Bas",   role: "Barbier", img: "../../assets/team-bas.jpg" },
];

const GALLERY = [
  { src: "../../assets/gallery-oldschool.jpg", wide: true },
  { src: "../../assets/gallery-products.jpg" },
  { src: "../../assets/gallery-shopfront.jpg" },
  { src: "../../assets/gallery-bro4life.jpg" },
];

function NavBar({ onBook, onNav }) {
  const [solid, setSolid] = React.useState(false);
  React.useEffect(() => {
    const h = () => setSolid(window.scrollY > 40);
    window.addEventListener("scroll", h); h();
    return () => window.removeEventListener("scroll", h);
  }, []);
  return (
    <nav className={"nav" + (solid ? " solid" : "")}>
      <img className="nav-logo" src="../../assets/logo-gold.png" alt="Kameraad" onClick={() => onNav("top")} style={{ cursor: "pointer" }} />
      <div className="nav-links">
        <span className="nav-link" onClick={() => onNav("team")}>Barbiers</span>
        <span className="nav-link" onClick={() => onNav("gallery")}>Shop</span>
        <span className="nav-link" onClick={() => onNav("visit")}>Bezoek</span>
        <Button variant="ghost" size="sm" onClick={() => onBook(null)}>Boek een afspraak</Button>
      </div>
    </nav>
  );
}

function Hero({ onBook }) {
  return (
    <header className="hero" data-section="top">
      <img className="hero-bg" src="../../assets/gallery-oldschool.jpg" alt="" />
      <div className="hero-veil"></div>
      <div className="hero-inner">
        <img className="hero-lockup" src="../../assets/hero-banner.png" alt="Kameraad HaarSnijder" />
        <p className="hero-tag">The last retreat for men of all ages — in the heart of Leuven.</p>
        <Button variant="primary" onClick={() => onBook(null)} icon="scissors">Book an appointment</Button>
      </div>
      <Icon name="chevron-down" className="scroll-cue" />
    </header>
  );
}

function Intro() {
  return (
    <section className="section intro">
      <Ornament />
      <p className="intro-lead" style={{ marginTop: 24 }}>There was no such thing as a gentleman's retreat.</p>
      <p className="intro-body">
        So we built one. Kameraad grew out of a simple idea — a place for men to pause.
        It is by far the last retreat for men of all ages. Even customers who do not purchase
        a service are always welcome to take a break from everyday life.
      </p>
    </section>
  );
}

function Team({ onBook }) {
  return (
    <section className="section team" data-section="team">
      <SectionHead eyebrow="Haarsnijder en Barbier" title="Het Team" />
      <div className="team-grid">
        {TEAM.map((b) => (
          <article className="barber" key={b.name}>
            <div className="barber-ph"><img src={b.img} alt={b.name} /></div>
            <div className="barber-body">
              <h3 className="barber-name">{b.name}</h3>
              <p className="barber-role">{b.role}</p>
              <span className="book-link" onClick={() => onBook(b.name)}>
                Book <Icon name="arrow-right" />
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Gallery() {
  return (
    <section className="section gallery" data-section="gallery">
      <SectionHead eyebrow="Parijsstraat 29" title="De Zaak" light />
      <div className="gal-grid">
        {GALLERY.map((g, i) => (
          <figure className={"gal-cell" + (g.wide ? " wide" : "")} key={i}>
            <img src={g.src} alt="" />
          </figure>
        ))}
      </div>
    </section>
  );
}

function Visit({ onBook }) {
  return (
    <section className="section visit" data-section="visit">
      <SectionHead eyebrow="Get in touch" title="Bezoek Ons" light />
      <div className="visit-grid">
        <div className="visit-col">
          <h3>Adres</h3>
          <p className="visit-line">
            Parijsstraat 29<br />3000 Leuven, België<br />
            <a href="mailto:info@kameraadhaarsnijder.be">info@kameraadhaarsnijder.be</a><br />
            BTW BE10 0842 3183
          </p>
          <p className="visit-line" style={{ marginTop: 18, color: "#B7B0A1", fontSize: 14 }}>
            You can call us — but we're probably serving other customers. Best to book ahead.
          </p>
          <div className="visit-actions">
            <Button variant="primary" onClick={() => onBook(null)} icon="scissors">Book an appointment</Button>
            <Button variant="ghost" icon="phone">+32 486 33 67 14</Button>
          </div>
        </div>
        <div className="visit-col">
          <h3>Openingsuren</h3>
          <div className="hours-row"><span className="d">Dinsdag — Zaterdag</span><span className="t">10:00 – 20:00</span></div>
          <div className="hours-row"><span className="d">Maandag</span><span className="t muted">Check Instagram</span></div>
          <div className="hours-row"><span className="d">Zondag</span><span className="t muted">Check Instagram</span></div>
          <div className="hours-row"><span className="d">Feestdagen</span><span className="t muted">Check Instagram</span></div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const socials = ["instagram", "facebook", "youtube"];
  return (
    <footer className="footer">
      <img className="footer-logo" src="../../assets/logo-gold.png" alt="Kameraad" />
      <div className="socials">
        {socials.map((s) => <span className="social" key={s}><SocialGlyph name={s} /></span>)}
      </div>
      <span className="footer-meta">© Kameraad Haarsnijder — Leuven</span>
    </footer>
  );
}

Object.assign(window, { NavBar, Hero, Intro, Team, Gallery, Visit, Footer, TEAM });
