import React from "react";
import "../styles/certif.css";
import certif from "../assets/certif.png";
import Footer from "../components/Footer";

const Certif = ({ theme }) => {
  return (
    <>
      <div className="page-container">
        <div className="page-content">
          <h1>SYSTÈME DE MANAGEMENT DE LA QUALITÉ</h1>
          <h2 className="grade-text">IATF 16949 : 2016</h2>
          <hr />
          <div className="img-certif">
            <div className="cert-badge">CERTIFIÉ</div>
            <img src={certif} alt="certif" />
          </div>
          <div className="cert-stats">
            <div className="stat-item">
              <span className="number">25+</span>
              <span className="label">Années d'expérience</span>
            </div>
            <div className="stat-item">
              <span className="number">100%</span>
              <span className="label">Taux de qualité</span>
            </div>
            <div className="stat-item">
              <span className="number">100+</span>
              <span className="label">Clients mondiaux</span>
            </div>
            <div className="stat-item">
              <span className="number">24/7</span>
              <span className="label">Support production</span>
            </div>
          </div>
        </div>
      </div>
      <Footer theme={theme} />
    </>
  );
};

export default Certif;
