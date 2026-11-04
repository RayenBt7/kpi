import React from "react";
import "../styles/products_cable.css";
import imgCoax_cable from "../assets/coax.png";
import imgMultiC from "../assets/coax_multi.png";
import imgMultiC2 from "../assets/coax_multi2.png";
import imgFakra from "../assets/fakra.png";
import imgOther from "../assets/other.png";
import Footer from "../components/Footer";
const Products_cable = () => {
  return (
    <>
      <div className="page">
        <div className="product-hero">
          <h1>ASSEMBLAGES DE CÂBLES COAXIAUX</h1>
          <p className="product-summary">
            Conception et assemblage de câbles coaxiaux et connecteurs pour
            l'industrie automobile.
          </p>
        </div>

        <section className="product-section">
          <div className="product-grid">
            <div className="product-image-frame">
              <img
                src={imgCoax_cable}
                alt="Câble coaxial"
                className="products-image"
              />
            </div>
            <div>
              <h2>Câbles coaxiaux et multi-brins</h2>
              <hr className="section-divider" />
              <p>
                Impédance 50/120/150 ohms avec différents types tels que
                Dacar402, Dacar077, Dacar034, Dacar100, Dacar110, Dacar410,
                Dacar300, Dacar302, Dacar107-2, Dacar462 et Dacar310.
                <br />
                Câbles multi-brins : FLRY-A/B.
              </p>
              <div className="products-image-grid">
                <img
                  src={imgMultiC}
                  alt="Câble multi-brins 1"
                  className="products-image-small"
                />
                <img
                  src={imgMultiC2}
                  alt="Câble multi-brins 2"
                  className="products-image-small"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="product-section">
          <div className="product-grid reverse-grid">
            <div>
              <h2>Connecteur Fakra</h2>
              <hr className="section-divider" />
              <p>
                FAKRA SF : formé et estampé. FAKRA HFM : Fakra Mini haute
                vitesse. FAKRA étanche pour les applications exigeantes.
              </p>
            </div>
            <div className="product-image-frame">
              <img
                src={imgFakra}
                alt="Connecteur Fakra"
                className="products-image"
              />
            </div>
          </div>
        </section>

        <section className="product-section">
          <div className="product-grid">
            <div className="product-image-frame">
              <img
                src={imgOther}
                alt="Autres connecteurs"
                className="products-image"
              />
            </div>
            <div>
              <h2>Autres connecteurs</h2>
              <hr className="section-divider" />
              <p>UEC, TNC, droit et angle droit, prise radio.</p>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
};
export default Products_cable;
