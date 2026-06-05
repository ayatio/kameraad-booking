/* Booking modal — barber → service → time → confirmation */

const SERVICES = [
  { name: "Knippen", sub: "Haircut", price: "€26", ic: "scissors" },
  { name: "Baard", sub: "Beard trim", price: "€18", ic: "wind" },
  { name: "Knippen + Baard", sub: "Full service", price: "€39", ic: "sparkles" },
  { name: "Kids cut", sub: "< 12 jaar", price: "€20", ic: "smile" },
];

const SLOTS = ["10:00", "10:45", "11:30", "13:00", "13:45", "14:30", "16:00", "16:45", "17:30", "18:15", "19:00", "19:45"];
const BLOCKED = new Set(["11:30", "16:00", "19:45"]);

function BookingModal({ initialBarber, onClose }) {
  useLucide();
  const [step, setStep] = React.useState(initialBarber ? 1 : 0);
  const [barber, setBarber] = React.useState(initialBarber || null);
  const [service, setService] = React.useState(null);
  const [slot, setSlot] = React.useState(null);

  React.useEffect(() => { if (window.lucide) window.lucide.createIcons(); });
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const titles = ["Kies je barbier", "Kies een service", "Kies een tijd", "Bevestigd"];

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <button className="modal-close" onClick={onClose}><Icon name="x" /></button>
          <Ornament />
          <p className="modal-eyebrow">Boek een afspraak</p>
          <h2 className="modal-title">{titles[step]}</h2>
          {step < 3 && (
            <div className="steps">
              {[0, 1, 2].map((i) => <span key={i} className={"step-dot" + (i <= step ? " on" : "")}></span>)}
            </div>
          )}
        </div>

        <div className="modal-body">
          {step === 0 && (
            <React.Fragment>
              <p className="field-label">Barbier</p>
              <div className="opt-grid">
                {TEAM.map((b) => (
                  <div key={b.name} className={"opt" + (barber === b.name ? " sel" : "")}
                       onClick={() => { setBarber(b.name); setStep(1); }}>
                    <img className="opt-av" src={b.img} alt="" />
                    <div className="opt-main"><p className="opt-name">{b.name}</p><p className="opt-sub">{b.role}</p></div>
                  </div>
                ))}
              </div>
            </React.Fragment>
          )}

          {step === 1 && (
            <React.Fragment>
              <p className="field-label">Service</p>
              <div className="opt-grid">
                {SERVICES.map((s) => (
                  <div key={s.name} className={"opt" + (service === s.name ? " sel" : "")}
                       onClick={() => { setService(s.name); setStep(2); }}>
                    <span className="opt-ic"><Icon name={s.ic} /></span>
                    <div className="opt-main"><p className="opt-name">{s.name}</p><p className="opt-sub">{s.sub}</p></div>
                    <span className="opt-price">{s.price}</span>
                  </div>
                ))}
              </div>
              <div className="modal-foot">
                <button className="link-back" onClick={() => setStep(0)}>← Barbier</button>
                <span className="summary-line">Bij <b>{barber}</b></span>
              </div>
            </React.Fragment>
          )}

          {step === 2 && (
            <React.Fragment>
              <p className="field-label">Vandaag · beschikbare tijden</p>
              <div className="slot-grid">
                {SLOTS.map((t) => (
                  <button key={t} className={"slot" + (slot === t ? " sel" : "")}
                          disabled={BLOCKED.has(t)} onClick={() => setSlot(t)}>{t}</button>
                ))}
              </div>
              <div className="modal-foot">
                <button className="link-back" onClick={() => setStep(1)}>← Service</button>
                <Button variant="primary" size="sm" disabled={!slot} onClick={() => setStep(3)} icon="check">Bevestig</Button>
              </div>
            </React.Fragment>
          )}

          {step === 3 && (
            <div className="confirm">
              <div className="confirm-ic"><Icon name="check" /></div>
              <h3>Tot snel, kameraad</h3>
              <p>Je stoel staat klaar. We sturen een herinnering — neem gerust de tijd.</p>
              <div className="confirm-card">
                <div className="r"><span className="k">Barbier</span><span className="v">{barber}</span></div>
                <div className="r"><span className="k">Service</span><span className="v">{service}</span></div>
                <div className="r"><span className="k">Tijd</span><span className="v">Vandaag · {slot}</span></div>
                <div className="r"><span className="k">Adres</span><span className="v">Parijsstraat 29</span></div>
              </div>
              <Button variant="ghost-ink" onClick={onClose}>Sluiten</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { BookingModal });
