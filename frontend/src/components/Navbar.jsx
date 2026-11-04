import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import "./Navbar.css";
import logo from "../assets/lg.svg";
import { FaSignInAlt, FaSignOutAlt } from "react-icons/fa";

const Navbar = ({
  authUser,
  isAuthenticated,
  onLogout,
  theme = "dark",
  onToggleTheme,
}) => {
  const location = useLocation();
  const displayName =
    authUser?.username ||
    authUser?.responsable ||
    authUser?.email ||
    "Connected";

  // Dropdown states
  const [productsDropdown, setProductsDropdown] = useState(false);
  const [servicesDropdown, setServicesDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavLinkClick = () => {
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  };

  // Hide navbar entirely on the KPI login page
  if (location.pathname === "/kpi") {
    return null;
  }

  return (
    <>
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <img src={logo} alt="AAF logo" className="navbar-logo-image" />
        </Link>

        <button
          type="button"
          className={`navbar-burger ${mobileMenuOpen ? "open" : ""}`}
          aria-label="Toggle navigation"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        {/* ── Navigation links ── */}
        <ul className={`navbar-menu ${mobileMenuOpen ? "open" : ""}`}>
          {isAuthenticated ? (
            // Authenticated user links
            <>
              {authUser?.isAdmin && (
              <li className="navbar-item">
                <Link
                  to="/ai-copilot"
                  className={`navbar-link ${location.pathname === "/ai-copilot" ? "active" : ""}`}
                  onClick={handleNavLinkClick}
                >
                  <span className="navbar-link-icon">🤖</span>
                  AI AAF
                </Link>
              </li>
              )}
              {/*<li className="navbar-item">
                <Link
                  to="/presentation"
                  className={`navbar-link ${location.pathname === "/presentation" ? "active" : ""}`}
                  onClick={handleNavLinkClick}
                >
                  <span className="navbar-link-icon">📋</span>
                  Presentation
                </Link>
              </li>*/}

              <li className="navbar-item">
                <Link
                  to="/plan-action"
                  className={`navbar-link ${location.pathname.startsWith("/plan-action") ? "active" : ""}`}
                  onClick={handleNavLinkClick}
                >
                  <span className="navbar-link-icon">📋</span>
                  Plan d'action
                </Link>
              </li>
              <li className="navbar-item">
                <Link
                  to="/dashboard"
                  className={`navbar-link ${location.pathname === "/dashboard" ? "active" : ""}`}
                  onClick={handleNavLinkClick}
                >
                  <span className="navbar-link-icon">📊</span>
                  KPI
                </Link>
              </li>
             {/* <li className="navbar-item">
                <Link
                  to="/threeD"
                  className={`navbar-link ${location.pathname === "/threeD" ? "active" : ""}`}
                  onClick={handleNavLinkClick}
                >
                  <span className="navbar-link-icon">🎨</span>
                  3D
                </Link>
              </li>*/}
            </>
          ) : (
            // Visitor links
            <>
              <li className="navbar-item">
                <Link
                  to="/company"
                  className={`navbar-link ${location.pathname === "/company" ? "active" : ""}`}
                  onClick={handleNavLinkClick}
                >
                  Our Company
                </Link>
              </li>
              <li className="navbar-item">
                <Link
                  to="/certifications"
                  className={`navbar-link ${location.pathname === "/certifications" ? "active" : ""}`}
                  onClick={handleNavLinkClick}
                >
                  Certifications
                </Link>
              </li>
              <li className="navbar-item dropdown">
                <div
                  className="dropdown-wrapper"
                  onMouseEnter={() => setProductsDropdown(true)}
                  onMouseLeave={() => setProductsDropdown(false)}
                  onClick={() => setProductsDropdown((open) => !open)}
                >
                  <div className="navbar-link dropdown-toggle">
                    Our Products
                    <span className="dropdown-arrow">▼</span>
                  </div>
                  {productsDropdown && (
                    <ul className="dropdown-menu">
                      <li>
                        <Link
                          to="/products/cable-assembly"
                          className="dropdown-item"
                          onClick={handleNavLinkClick}
                        >
                          Cable Assembly
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/products/automotive-antennas"
                          className="dropdown-item"
                          onClick={handleNavLinkClick}
                        >
                          Automotive Antennas
                        </Link>
                      </li>
                    </ul>
                  )}
                </div>
              </li>
              <li className="navbar-item dropdown">
                <div
                  className="dropdown-wrapper"
                  onMouseEnter={() => setServicesDropdown(true)}
                  onMouseLeave={() => setServicesDropdown(false)}
                  onClick={() => setServicesDropdown((open) => !open)}
                >
                  <div className="navbar-link dropdown-toggle">
                    Services
                    <span className="dropdown-arrow">▼</span>
                  </div>
                  {servicesDropdown && (
                    <ul className="dropdown-menu">
                      <li>
                        <Link
                          to="/services/technologies"
                          className="dropdown-item"
                          onClick={handleNavLinkClick}
                        >
                          Technologies
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/services/quality-assurance"
                          className="dropdown-item"
                          onClick={handleNavLinkClick}
                        >
                          Quality Assurance
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/services/quality-policies"
                          className="dropdown-item"
                          onClick={handleNavLinkClick}
                        >
                          Quality Policies
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/services/supply-chain"
                          className="dropdown-item"
                          onClick={handleNavLinkClick}
                        >
                          Supply Chain
                        </Link>
                      </li>
                    </ul>
                  )}
                </div>
              </li>
              <li className="navbar-item">
                <Link
                  to="/references"
                  className={`navbar-link ${location.pathname === "/references" ? "active" : ""}`}
                  onClick={handleNavLinkClick}
                >
                  References
                </Link>
              </li>
              <li className="navbar-item">
                <Link
                  to="/contact"
                  className={`navbar-link ${location.pathname === "/contact" ? "active" : ""}`}
                  onClick={handleNavLinkClick}
                >
                  Contact Us
                </Link>
              </li>
            </>
          )}
        </ul>

        {/* ── Right side: theme + user ── */}
        <div className="navbar-right">
          <button
            type="button"
            className="navbar-theme-toggle"
            onClick={onToggleTheme}
          >
            {theme === "dark" ? "☀ Clair" : "🌙 Sombre"}
          </button>
          {!isAuthenticated && (
            <div className="navbar-item navbar-login">
              <Link
                to="/dashboard"
                className={`navbar-link ${location.pathname === "/dashboard" ? "active" : ""}`}
                onClick={handleNavLinkClick}
              >
                <span className="navbar-link-icon">
                  <FaSignInAlt />
                </span>
                Se connecter
              </Link>
            </div>
          )}

          {isAuthenticated && (
            <div className="navbar-auth-item">
              <span className="navbar-user">
                {authUser?.isAdmin && (
                  <span className="navbar-role-badge">👑</span>
                )}
                {displayName}
              </span>
              <button
                type="button"
                className="navbar-logout"
                onClick={onLogout}
              >
                <span className="navbar-link-icon">
                  <FaSignOutAlt></FaSignOutAlt>
                </span>
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
    <div className="navbar-spacer" aria-hidden="true" />
    </>
  );
};

export default Navbar;
