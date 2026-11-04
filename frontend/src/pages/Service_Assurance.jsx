import React from "react";
import { FaCheck } from "react-icons/fa";
import q1 from "../assets/q1.png";
import rf_test from "../assets/RF_test.png";
import dc_test from "../assets/DC_test.png";
import meol from "../assets/M-eol.png";
import Footer from "../components/Footer";

const Service_Assurance = ({ theme }) => {
  const items = [
    "SPC",
    "Peel force test",
    "Climate control examination",
    "Thermal Imaging Machine (Infrared)",
  ];

  return (
    <>
      <div className="page-container">
        <div className="page-content">
          <h1>ASSURANCE QUALITÉ</h1>
          <h2>Quelques-unes de nos technologies de contrôle qualité</h2>
          <hr />
          <ul>
            {items.map((item) => (
              <li key={item}>
                <FaCheck />
                {item}
              </li>
            ))}
          </ul>
          <img src={q1} alt="Qualité" />
          <h1>TECHNOLOGIES D'INSPECTION</h1>
          <h2>Tests haute tension et RF/DC</h2>
          <hr />
          <h1>Test RF (Réflexion S11, Transmission S21) avec analyseur</h1>
          <h3>
            <FaCheck />
            Plage de fréquences 300 kHz – 8 GHz
          </h3>
          <h3>
            <FaCheck />
            Test SPC 5 % par équipe ou par commande de production
          </h3>
          <img src={rf_test} alt="Test RF" />
          <h1>Test DC (détection ouverture-court-circuit) avec multimètre</h1>
          <h3>
            <FaCheck />
            Détection d’une condition ouverte et/ou court-circuit (conducteur
            interne/externe)
          </h3>
          <h3>
            <FaCheck />
            Test SPC 5 % par équipe ou par commande de production
          </h3>
          <img src={dc_test} alt="Test DC" />
          <h1>M-EOL (Contrôle mécanique fin de ligne)</h1>
          <h3>
            <FaCheck />
            Détection de certains aspects mécaniques importants
          </h3>
          <img src={meol} alt="M-EOL" />
        </div>
      </div>
      <Footer theme={theme} />
    </>
  );
};

export default Service_Assurance;
