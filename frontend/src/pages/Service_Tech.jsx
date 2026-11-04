import React from "react";
import "../styles/service_tech.css";
import ultraSonic_soldering from "../assets/ultraSonic_soldering.png";
import cableCutting from "../assets/cable_cutting.png";
import crimping from "../assets/crimping.png";
import autoSoldering from "../assets/auto_soldering.png";
import overMolding from "../assets/overmodeling.png";
import riveting from "../assets/riveting.png";
import screwing from "../assets/screwing.png";
import selective from "../assets/selective.png";
import Footer from "../components/Footer";

const Service_Tech = ({ theme }) => {
  const technologies = [
    {
      name: "Soudure ultrasonique",
      img: ultraSonic_soldering,
      desc: "Assemblage de métal précis sans flux",
    },
    {
      name: "Découpe de câbles",
      img: cableCutting,
      desc: "Découpe automatisée de précision selon les spécifications",
    },
    {
      name: "Sertissage",
      img: crimping,
      desc: "Technologie de sertissage de terminaux haute précision",
    },
    {
      name: "Soudure automatique",
      img: autoSoldering,
      desc: "Conforme aux normes IPC 610 et 620",
    },
    {
      name: "Soudure sélective",
      img: selective,
      desc: "Soudure de précision pour ensembles complexes",
    },
    {
      name: "Surmoulage",
      img: overMolding,
      desc: "Technomelt sur PCB FR4/Flex",
    },
    {
      name: "Rivetage",
      img: riveting,
      desc: "Fixation mécanique haute résistance",
    },
    {
      name: "Visserie",
      img: screwing,
      desc: "Couple et angle 100 % contrôlés",
    },
  ];

  return (
    <>
      <div className="tech-hero">
        <div className="tech-hero-overlay"></div>
        <div className="tech-hero-content">
          <h1>TECHNOLOGIES DE PRODUCTION</h1>
          <p>Processus de fabrication avancés pour l'excellence automobile</p>
        </div>
      </div>
      <div className="tech-content">
        <div className="tech-grid">
          {technologies.map((tech, i) => (
            <div key={i} className="tech-card">
              <div className="tech-card-inner">
                <div className="tech-front">
                  <div className="tech-img-wrapper">
                    <img src={tech.img} alt={tech.name} />
                  </div>
                </div>
                <div className="tech-back">
                  <h3>{tech.name}</h3>
                  <p>{tech.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="tech-specs">
          <h2 className="tech-title">Assurance qualité et normes</h2>
          <div className="tech-specs-grid">
            <div className="tech-spec">
              <span className="tech-icon">✓</span>
              <h3>IPC-Norm 610</h3>
              <p>Acceptabilité des assemblages électroniques</p>
            </div>
            <div className="tech-spec">
              <span className="tech-icon">✓</span>
              <h3>IPC-Norm 620</h3>
              <p>
                Exigences pour les assemblages électriques et électroniques
                soudés
              </p>
            </div>
            <div className="tech-spec">
              <span className="tech-icon">✓</span>
              <h3>Contrôle à 100%</h3>
              <p>Couple de vissage et angle de torsion vérifiés</p>
            </div>
            <div className="tech-spec">
              <span className="tech-icon">✓</span>
              <h3>Fixation vissée sécurisée</h3>
              <p>Exigences de qualité les plus élevées garanties</p>
            </div>
          </div>
        </div>
      </div>
      <Footer theme={theme} />
    </>
  );
};

export default Service_Tech;
