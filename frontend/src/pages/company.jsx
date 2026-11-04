/* eslint-disable no-undef */
import React from "react";
import "../styles/company.css";
import logo from "../assets/aaf.png";
import map from "../assets/map.png";
import { FaCheck } from "react-icons/fa";
import Footer from "../components/Footer";

const Company = ({ theme = "dark" }) => {
  const items = [
    "Fabrication de pointe",
    "Certifié IATF 16949",
    "Certifié ISO 9001, ISO 14001, ISO 45001",
    "Partenariat d'expertise allemande",
    "Transmission EDI selon la norme VDA 4913",
  ];

  return (
    <>
      <div className="company-hero">
        <div className="company-hero-overlay"></div>
        <div className="company-hero-content">
          <h1>NOTRE ENTREPRISE</h1>
          <p>transparence, honnêteté & confiance</p>
        </div>
      </div>
      <div className="company-content">
        <div className="company-about">
          <img src={logo} alt="AAF logo" className="company-logo" />
          <p>
            <span>AAF Production SARL</span> <br />
            AAF Production SARL est une entreprise tunisienne spécialisée dans
            l'assemblage de câbles pour l'industrie automobile. Avec plus de 25
            ans d'expérience et plus de 100 ans d'expertise pionnière en haute
            fréquence grâce à notre partenaire allemand WISI Automotive GmbH &
            Co. KG, nous fournissons des produits de haute qualité sur lesquels
            les constructeurs automobiles du monde entier comptent pour leurs
            communications RF (antennes automobiles). Nous sommes certifiés IATF
            16949, ISO 9001, ISO 14001, ISO 45001 et TISAX. Nous sommes en cours
            d'obtention de la certification RSCI.
            <br />
            Nous utilisons la transmission EDI selon la norme VDA 4913 avec un
            délai de livraison de 10 jours ouvrables.
          </p>
          <div className="company-location">
            <img src={map} alt="Carte AAF" />
            <h3>Site de production</h3>
            <p>
              Notre site de production est situé sur la côte est de la Tunisie,
              dans la région de Messadine (ville de Sousse). Sousse est un
              centre industriel et touristique important en Tunisie.
            </p>
            <div className="company-facts">
              {items.map((item, index) => (
                <div key={index} className="company-fact">
                  <FaCheck /> {item}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="facts-section">
          <h2>CHIFFRES CLÉS</h2>
          <div className="facts-grid">
            <div className="fact-card">
              <div className="fact-value">25+</div>
              <div className="fact-label">Ans</div>
            </div>
            <div className="fact-card">
              <div className="fact-value">300</div>
              <div className="fact-label">Professionnels</div>
            </div>
            <div className="fact-card">
              <div className="fact-value">25+ ans</div>
              <div className="fact-label">Expertise</div>
            </div>
            <div className="fact-card">
              <div className="fact-value">100%</div>
              <div className="fact-label">Automobile</div>
            </div>
            <div className="fact-card">
              <div className="fact-value">100+</div>
              <div className="fact-label">Clients</div>
            </div>
            <div className="fact-card">
              <div className="fact-value">4500m2</div>
              <div className="fact-label">Production</div>
            </div>
          </div>
        </div>
      </div>
      <Footer theme={theme} />
    </>
  );
};

export default Company;
