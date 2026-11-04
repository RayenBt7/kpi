import React, { useState, useRef, useEffect } from "react";
import "../styles/Page.css";
import logo from "../assets/aaf.png";
import imgAntenne from "../assets/antenne.png";
import imgCoax_cable from "../assets/Coax_cable.png";
import imgDepartement from "../assets/departement.png";
import imgTest_labo from "../assets/test_labo.png";
import imgTest from "../assets/test.png";
import Footer from "../components/Footer";

import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import {
  FaCheck,
  FaArrowUp,
  FaBuilding,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaHome,
  FaLink,
  FaSignal,
  FaArrowRight,
} from "react-icons/fa";
const FontAwesomeIcon = ({ icon: Icon }) =>
  Icon ? <Icon aria-hidden="true" focusable="false" /> : null;
const byPrefixAndName = {
  fa: {
    check: FaCheck,
    sortUp: FaArrowUp,
    chaine: FaLink,
    signal: FaSignal,
    arrowRight: FaArrowRight,
  },
  fas: {
    building: FaBuilding,
    envelope: FaEnvelope,
    phone: FaPhone,
    mapMarkerAlt: FaMapMarkerAlt,
    home: FaHome,
  },
};

const Home = ({ theme = "dark" }) => {
  const isDark = theme === "dark";
  const topRef = useRef(null);
  const scrollToTop = () => {
    topRef.current.scrollIntoView({ behavior: "smooth" });
  };
  const [show, setShow] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const items = [
    "Électronique",
    "Haute fréquence",
    "Technologie 3D",
    "Chambre de mesure d'antenne, aussi pour les mesures 5G",
    "Assemblage de prototypes",
    "Développement, modification, analyse et optimisation",
    "Services d'ingénierie et équipements de test sur mesure",
    "Laboratoire de tests",
  ];
  const navigate = useNavigate();

  return (
    <>
      <img src={logo} alt="AAF logo" className="bg-" />
      <div className={`page-container-1 ${isDark ? "dark" : "light"}`}>
        <h1 className={`title ${isDark ? "dark" : "light"}`}>
          A.A.F. Production SARL
        </h1>
        <div ref={topRef} className="page-content-1">
          <div className="mb-8">
            <h2 className={`title-2 ${isDark ? "dark" : "light"}`}>
              NOTRE ENTREPRISE
            </h2>
            <h2
              className={`text-lg mb-8 text-center ${isDark ? "text-slate-300" : "text-gray-600"}`}
            >
              transparence, honnêteté & confiance
            </h2>
            <hr />
            <div className="logo-p">
              <img src={logo} alt="AAF logo" className="bg" />
              <div className="line">
                <p
                  className={`leading-relaxed mb-4 ${isDark ? "text-slate-300" : "text-gray-600"}`}
                >
                  AAF Production SARL est une entreprise tunisienne spécialisée
                  dans l'assemblage de câbles pour l'industrie automobile. Avec
                  plus de 25 ans d'expérience et un accès à plus de 100 ans
                  d'expertise de pointe en haute fréquence grâce à notre
                  partenaire allemand WISI Automotive GmbH & Co. KG, nous
                  fournissons des produits de haute qualité sur lesquels les
                  constructeurs automobiles du monde entier comptent pour leurs
                  communications RF (antennes automobiles).
                </p>
                <button
                  className="read-more company-read-more"
                  onClick={() => navigate("/company")}
                >
                  <span className="read-more-text">En savoir plus</span>
                  <FontAwesomeIcon
                    icon={byPrefixAndName.fa.arrowRight}
                    className="read-more-icon"
                  />
                </button>
              </div>
            </div>

            <div className="products-section">
              <h1 className={`title ${isDark ? "dark" : "light"}`}>
                NOS PRODUITS
              </h1>

              <div className="h-r">
                <Link to="/products/cable-assembly" className="product-link">
                  <div className="cable">
                    <div className="icon">
                      <FontAwesomeIcon icon={byPrefixAndName.fa.chaine} />
                    </div>
                    <h2>Assemblages de câbles coaxiaux</h2>
                    <hr />
                  </div>
                </Link>
                <Link
                  to="/products/automotive-antennas"
                  className="product-link"
                >
                  <div className="antenne">
                    <div className="icon">
                      <FontAwesomeIcon
                        style={{ fontSize: "60px" }}
                        icon={byPrefixAndName.fa.signal}
                      />
                    </div>
                    <h2>Antennes automobiles</h2>
                    <hr />
                  </div>
                </Link>
              </div>
              <div className="img">
                <img src={imgAntenne} text="Antenne" alt="Antenne automobile" />
                <img src={imgCoax_cable} alt="Câble coaxial" />
              </div>
            </div>
            <div className="dev-container">
              <h1 className={`title-3 ${isDark ? "dark" : "light"}`}>
                DÉVELOPPEMENT ET CONCEPTION EN ALLEMAGNE
              </h1>
              <h2
                className={`text-lg mb-8 text-center ${isDark ? "text-slate-300" : "text-gray-600"}`}
              >
                WISI Automotive GmbH & Co. KG
              </h2>
              <hr />
              <div className="img-ls-container">
                <ul
                  className={`list-none space-y-2 ${isDark ? "text-slate-300" : "text-gray-600"}`}
                >
                  {items.map((item) => (
                    <li key={item}>
                      <FontAwesomeIcon icon={byPrefixAndName.fa.check} /> {item}
                    </li>
                  ))}
                </ul>
                <div className="img-container">
                  <img src={imgDepartement} alt="Département" />

                  <img src={imgTest_labo} alt="Laboratoire de test" />

                  <img src={imgTest} alt="Équipement de test" />

                  <div className="p-container">
                    <p>Développement</p>
                    <p>Laboratoire de tests</p>
                    <p>Équipements de test</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="certif">
              <h2
                className={`text-2xl font-semibold mb-4 border-b-2 border-blue-500 pb-2 ${
                  isDark ? "text-slate-100" : "text-gray-700"
                }`}
              >
                NOUS SOMMES PLEINEMENT ACCRÉDITÉS !
              </h2>
              <p
                className={`leading-relaxed ${isDark ? "text-slate-300" : "text-gray-600"}`}
              >
                IATF 16949 | ISO14001 | ISO 9001 | ISO 45001
              </p>
              <button
                className="read-more company-read-more"
                onClick={() => navigate("/certifications")}
              >
                <span className="read-more-text">NOS CERTIFICATS</span>
                <FontAwesomeIcon
                  icon={byPrefixAndName.fa.arrowRight}
                  className="read-more-icon"
                />
              </button>
            </div>
          </div>
          <Footer theme={theme} />
        </div>
        {show && (
          <button className="top-button" onClick={scrollToTop}>
            <FontAwesomeIcon icon={byPrefixAndName.fa.sortUp} />
          </button>
        )}
      </div>
    </>
  );
};

export default Home;
