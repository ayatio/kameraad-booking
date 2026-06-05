/* App — composes the page + booking modal state + smooth scroll nav */

function App() {
  const [booking, setBooking] = React.useState(null); // null=closed, {} or {barber}

  React.useEffect(() => { if (window.lucide) window.lucide.createIcons(); });

  const openBook = (barber) => setBooking({ barber: barber || null });
  const closeBook = () => setBooking(null);

  const goTo = (key) => {
    if (key === "top") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const el = document.querySelector(`[data-section="${key}"]`);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: "smooth" });
  };

  return (
    <div className="kx">
      <NavBar onBook={openBook} onNav={goTo} />
      <Hero onBook={openBook} />
      <Intro />
      <Team onBook={openBook} />
      <Gallery />
      <Visit onBook={openBook} />
      <Footer />
      {booking && <BookingModal initialBarber={booking.barber} onClose={closeBook} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
