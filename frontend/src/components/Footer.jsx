import React from "react";
import "../styles/Page.css";
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
} from "react-icons/fa";
const FontAwesomeIcon = ({ icon: Icon }) =>
  Icon ? <Icon aria-hidden="true" focusable="false" /> : null;
const byPrefixAndName = {
  fa: {
    check: FaCheck,
    sortUp: FaArrowUp,
    chaine: FaLink,
    signal: FaSignal,
  },
  fas: {
    building: FaBuilding,
    envelope: FaEnvelope,
    phone: FaPhone,
    mapMarkerAlt: FaMapMarkerAlt,
    home: FaHome,
  },
};
const Footer = ({ theme = "dark" }) => {
  const isDark = theme === "dark";
  const navigate = useNavigate();

  return (
    <>
      <footer className="site-footer">
        <div className="about">
          <h2>About us</h2>
          <hr className="large" />
          <p>
            Over 20 years of of Specialized Cable Assembly Expertise company
            with the access to over 100 years of pioneering expertise in High
            Frequency Technology through our German partner WISI Automotive
            GmbH...
          </p>
          <p
            className={`text-center ${isDark ? "text-slate-300" : "text-gray-600"}`}
          >
            &copy; 2023 AAF Production SARL. All rights reserved.
          </p>
          <button className="read-more" onClick={() => navigate("/contact")}>
            Read More
          </button>
        </div>
        <div className="get-in">
          <h2>Get in Touch</h2>
          <hr />
          <p className="infos">
            <span className="info-line">
              <FontAwesomeIcon icon={byPrefixAndName.fas.building} />
              <span>A.A.F Production SARL</span>
            </span>

            <span className="info-line">
              <FontAwesomeIcon icon={byPrefixAndName.fas.envelope} />
              <span>info@aaf.com.in</span>
            </span>

            <span className="info-line">
              <FontAwesomeIcon icon={byPrefixAndName.fas.phone} />
              <span>+216 36 204 600</span>
            </span>

            <span className="info-line">
              <FontAwesomeIcon icon={byPrefixAndName.fas.home} />
              <span>Rue de Kairouan , BP65</span>
            </span>

            <span className="info-line">
              <span>4013 Messadine - Tunisia</span>
            </span>

            <a
              className="info-line link"
              href="https://www.google.com/maps/place/AAF+Production+SARL/@36.1998687,10.5956825,8z/data=!4m6!3m5!1s0x12fdf5715f54a7a1:0xdb109145f6511770!8m2!3d35.7573232!4d10.602636!16s%2Fg%2F11dyymqy3l"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FontAwesomeIcon icon={byPrefixAndName.fas.mapMarkerAlt} />
              <span>View large map</span>
            </a>
          </p>
        </div>
      </footer>
    </>
  );
};
export default Footer;
