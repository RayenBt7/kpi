import React from "react";
import "../styles/references.css";
import Footer from "../components/Footer";
import skoda from "../assets/skoda.png";
import volkswagen from "../assets/volswagen.png";
import bmw from "../assets/bmw.png";
import prosche from "../assets/porsche.png";
import lamborghini from "../assets/lamborghini.png";
import audi from "../assets/audi.png";
import mercedes from "../assets/mercides.png";
import harleyDavidson from "../assets/harleyDavidson.png";
import mclaren from "../assets/mclaren.png";
import volvo from "../assets/volvo.png";
import bentley from "../assets/w.png";
import antolin from "../assets/antolin.png";
import aptiv from "../assets/aptiv.png";
import draxlmaier from "../assets/draxlmaier.png";
import fujikura from "../assets/fujikura.png";
import leoni from "../assets/leoni.png";
import sumitomo from "../assets/sumitomo.png";
import ks from "../assets/ks.png";
import magna from "../assets/magna.png";
import smr from "../assets/smr.png";
import sas from "../assets/sas.png";
const References = ({ theme }) => {
  const tier1Clients = [
    { name: "skoda", logo: skoda },
    { name: "BMW Group", logo: bmw },
    { name: "Volkswagen", logo: volkswagen },
    { name: "Porsche", logo: prosche },
    { name: "Lamborghini", logo: lamborghini },
    { name: "Audi", logo: audi },
    { name: "Mercedes-Benz", logo: mercedes },
    { name: "Harley-Davidson", logo: harleyDavidson },
    { name: "McLaren", logo: mclaren },
    { name: "Volvo", logo: volvo },
    { name: "Bentley", logo: bentley },
  ];

  const tier2Clients = [
    { name: "Aptiv", logo: aptiv },
    { name: "Magna", logo: magna },
    { name: "Leoni", logo: leoni },
    { name: "Sumitomo", logo: sumitomo },
    { name: "Draxlmaier", logo: draxlmaier },
    { name: "Fujikura", logo: fujikura },
    { name: "Antolin", logo: antolin },
    { name: "SMR", logo: smr },
    { name: "KS", logo: ks },
    { name: "SAS", logo: sas },
  ];

  return (
    <>
      <div className="ref-hero">
        <div className="ref-hero-overlay"></div>
        <div className="ref-hero-content">
          <h1>NOS PARTENAIRES RÉFÉRENTS</h1>
          <p>
            Liste de nos principaux clients pour lesquels nous sommes
            fournisseur Tier 1 et Tier 2.
          </p>
        </div>
      </div>
      <div className="ref-content">
        <div className="ref-section">
          <h2 className="ref-badge">AAF est fournisseur Tier 1</h2>
          <p className="ref-desc">
            Fourniture directe aux constructeurs automobiles pour des systèmes
            critiques.
          </p>
          <div className="ref-grid">
            {tier1Clients.map((client, i) => (
              <div key={i} className="ref-card">
                <div className="ref-card-inner">
                  <div className="ref-card-front">
                    <img
                      src={client.logo}
                      alt={`${client.name} logo`}
                      className="ref-logo-img"
                    />
                  </div>
                  <div className="ref-card-back">
                    <h3>{client.name}</h3>
                    <span className="ref-tier">Certifié Tier 1</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="ref-section">
          <h2 className="ref-badge ref-badge-secondary">
            AAF est fournisseur Tier 2
          </h2>
          <p className="ref-desc">
            Soutien aux fournisseurs Tier 1 avec des composants et assemblages
            de qualité
          </p>
          <div className="ref-grid">
            {tier2Clients.map((client, i) => (
              <div key={i} className="ref-card">
                <div className="ref-card-inner">
                  <div className="ref-card-front">
                    <img
                      src={client.logo}
                      alt={`${client.name} logo`}
                      className="ref-logo-img"
                    />
                  </div>
                  <div className="ref-card-back">
                    <h3>{client.name}</h3>
                    <span className="ref-tier">Partenaire Tier 2</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="ref-stats">
            <div className="ref-stat">
              <span className="ref-stat-num">25+</span>
              <span className="ref-stat-label">Pays desservis</span>
            </div>
            <div className="ref-stat">
              <span className="ref-stat-num">500+</span>
              <span className="ref-stat-label">Projets actifs</span>
            </div>
            <div className="ref-stat">
              <span className="ref-stat-num">99.8%</span>
              <span className="ref-stat-label">Taux de livraison</span>
            </div>
          </div>
        </div>
      </div>
      <Footer theme={theme} />
    </>
  );
};

export default References;
