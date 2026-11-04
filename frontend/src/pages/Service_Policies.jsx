import React from "react";
import csr from "../assets/csr.png";
import ims from "../assets/ims.png";
import Footer from "../components/Footer";
import "../styles/service_policies.css";

const Service_Policies = ({ theme }) => {
  return (
    <>
      <div className="policy-hero">
        <div className="policy-hero-overlay"></div>
        <div className="policy-hero-content">
          <h1>Politiques Qualité</h1>
          <p>Notre engagement pour l'excellence et les pratiques durables</p>
        </div>
      </div>
      <div className="policy-content">
        <div className="policy-card">
          <h2>
            <span className="policy-icon">✓</span> Politique RSE
          </h2>
          <img src={csr} alt="RSE" />
          <p>
            Notre politique de responsabilité sociétale d'entreprise met
            l'accent sur le développement durable, la protection de
            l'environnement et le bien-être social.
          </p>
          <div className="policy-highlight">
            <strong>Axes clés :</strong> Protection de l'environnement,
            efficacité énergétique, bien-être des employés.
          </div>
        </div>
        <div className="policy-card">
          <h2>
            <span className="policy-icon">✓</span> Politique IMS
          </h2>
          <img src={ims} alt="IMS" />
          <p>
            Notre système de management intégré (IMS) combine les normes
            qualité, environnementales et de santé et sécurité au travail.
          </p>
          <div className="policy-highlight">
            <strong>Certifications :</strong> IATF 16949, ISO 9001, ISO 14001,
            ISO 45001
          </div>
        </div>
      </div>
      <Footer theme={theme} />
    </>
  );
};

export default Service_Policies;
