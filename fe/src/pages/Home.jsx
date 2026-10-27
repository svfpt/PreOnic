import { BrowserRouter, Routes, Route } from "react-router-dom";

// HOME
import Navbar from "../Component/Navbar/Navbar";
import Hero from "../Component/Hero/Hero";
import Process from "../Component/Process/Process";
import Campaigns from "../Component/Campaigns/Campaigns";
import AgricultureBanner from "../Component/AgricultureBanner/AgricultureBanner";
import Stats from "../Component/Stats/Stats";
import Footer from "../Component/Footer/Footer";

// SOLUTIONS & CONTACT
import Solutions from "../Component/Solutions/Solutions";
import Contact from "../Component/Contact/Contact";

// AUTH & REGISTER
import Auth from "../Component/Auth/Auth";
import Register from "../Component/Register/Register";

// DASHBOARD
import EnterpriseDashboard from "../Component/EnterpriseDashboard/EnterpriseDashboard";
import FarmerDashboard from "../Component/FarmerDashboard/FarmerDashboard";

function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <Process />
      <Campaigns />
      <AgricultureBanner />
      <Stats />
      <Footer />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* HOME */}
        <Route path="/" element={<Home />} />

        {/* SOLUTIONS */}
        <Route path="/solutions" element={<Solutions />} />

        {/* CONTACT */}
        <Route path="/contact" element={<Contact />} />

        {/* AUTH & REGISTER */}
        <Route path="/auth" element={<Auth />} />
        <Route path="/register" element={<Register />} />

        {/* DOANH NGHIỆP */}
        <Route path="/enterprise" element={<EnterpriseDashboard />} />

        {/* NÔNG DÂN */}
        <Route path="/farmer" element={<FarmerDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
