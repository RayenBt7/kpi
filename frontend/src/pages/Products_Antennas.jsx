import React from "react";
import "../styles/products_antennas.css";
import { FaCheck } from "react-icons/fa";
import imgMobile_connect from "../assets/mobile_connect.png";
import imgDistribu_RF from "../assets/distribu_RF.png";
import imgType1 from "../assets/type1.png";
import imgType2 from "../assets/type2.png";
import imgType3 from "../assets/type3.png";
import imgType4 from "../assets/type4.png";
import Footer from "../components/Footer";
const Products_Antennas = () => {
  const items1 = [
    "Antennes de toit",
    "Antennes cachées pour applications intérieures",
    "Antennes étanches pour applications extérieures",
  ];
  const items2 = [
    "Composants de distribution de signal",
    "Antennes intégrées pour signaux GPS numérisés",
  ];
  return (
    <>
      <div className="page-container products-page">
        <div className="product-hero">
          <h1>ANTENNES AUTOMOTIVES</h1>
          <p className="product-summary">
            Solutions RF embarquées pour véhicules, connectivité mobile et
            distribution de signaux.
          </p>
        </div>

        <section className="product-section">
          <div className="product-grid">
            <div>
              <h2>Communication mobile à bord</h2>
              <hr className="section-divider" />
              <ul className="products-list">
                {items1.map((item) => (
                  <li key={item}>
                    <FaCheck />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="product-image-frame">
              <img
                src={imgMobile_connect}
                alt="Communication mobile"
                className="products-image"
              />
            </div>
          </div>
        </section>

        <section className="product-section">
          <div className="product-grid reverse-grid">
            <div className="product-image-frame">
              <img
                src={imgDistribu_RF}
                alt="Distribution RF"
                className="products-image"
              />
            </div>
            <div>
              <h2>Distribution intelligente des signaux RF</h2>
              <hr className="section-divider" />
              <ul className="products-list">
                {items2.map((item) => (
                  <li key={item}>
                    <FaCheck />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="product-section">
          <div className="product-section-header">
            <h1>TYPES D'ANTENNES</h1>
            <hr className="section-divider" />
          </div>
          <div className="product-types-grid">
            <article className="product-card">
              <h2>AM/FM/DAB</h2>
              <img
                src={imgType1}
                alt="Antenne AM/FM/DAB"
                className="products-image"
              />
            </article>
            <article className="product-card">
              <h2>GSM/4G/LTE/5G</h2>
              <img
                src={imgType2}
                alt="Antenne GSM/4G/LTE/5G"
                className="products-image"
              />
            </article>
            <article className="product-card">
              <h2>GSM/4G/LTE/5G</h2>
              <img
                src={imgType3}
                alt="Antenne GSM/4G/LTE/5G"
                className="products-image"
              />
            </article>
            <article className="product-card">
              <h2>WLAN/BLUETOOTH</h2>
              <img
                src={imgType4}
                alt="Antenne WLAN/Bluetooth"
                className="products-image"
              />
            </article>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
};
export default Products_Antennas;
