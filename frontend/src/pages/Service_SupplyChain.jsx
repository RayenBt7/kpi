import React from "react";
import position from "../assets/position.png";
import worldWide from "../assets/WORLDWIDE.png";
import Footer from "../components/Footer";
const Service_SupplyChain = () => {
  return (
    <div className="page-container">
      <div className="page-content">
        <h1>LIVRAISON MONDIALE</h1>
        <hr />
        <img src={worldWide} alt="LIVRAISON MONDIALE" />
        <h1>ITINÉRAIRES DE TRANSPORT</h1>
        <hr />
        <p>
          <span>Itinéraire 1 (route standard)</span>
          <br />
          AAF Tunisie {">>"} Dachau Munich (via Gênes, Italie) <br />
          <span>Itinéraire 2 (route secondaire)</span>
          <br />
          AAF Tunisie {">>"} Dachau Munich (via Marseille, France) <br />
          <span>Itinéraire 3 (livraison aérienne)</span>
          <br />
          AAF Tunisie {">>"} Directement chez le client OEM
        </p>
        <img src={position} alt="Position" />
      </div>
      <Footer />
    </div>
  );
};

export default Service_SupplyChain;
