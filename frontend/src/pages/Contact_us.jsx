import React from "react";
import Footer from "../components/Footer";
import "../styles/contact.css";
import { FaCheck, FaArrowUp, FaBuilding, FaEnvelope, FaPhone, FaMapMarkerAlt, FaHome, FaLink, FaSignal } from "react-icons/fa";
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

const Contact_us = () => {
   const [formData, setFormData] = React.useState({ name: '', email: '', message: '' });
   const [status, setStatus] = React.useState('');
   const [isSubmitting, setIsSubmitting] = React.useState(false);

   const handleChange = (e) => {
       setFormData({ ...formData, [e.target.name]: e.target.value });
   };

   const handleSubmit = async (e) => {
       e.preventDefault();
       setIsSubmitting(true);
       setStatus('');

       try {
           const response = await fetch('/api/contact', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(formData)
           });
           const data = await response.json();
           if (response.ok) {
               setStatus('Message envoyé avec succès!');
               setFormData({ name: '', email: '', message: '' });
           } else {
               setStatus(data.error || 'Échec de l\'envoi');
           }
       } catch (error) {
           setStatus('Erreur réseau. Veuillez réessayer.');
       } finally {
           setIsSubmitting(false);
       }
   };

   return (
     <>
       <div className="page-container">
         <div className="page-content">
           <div className="contact-header">
             <h2>Coordonnées AAF</h2>
             <hr />
             <h1>A.A.F. Production SARL</h1>
             <h1>Contactez AAF</h1>
           </div>
           <div className="contact-content">
             <div className="contact-info-card">
               <p className="infos" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                 <span className="contact-item">
                   <FontAwesomeIcon icon={byPrefixAndName.fas.building} />
                   <span className="contact-item-content"><span>A.A.F Production SARL</span></span>
                 </span>
                 <span className="contact-item">
                   <FontAwesomeIcon icon={byPrefixAndName.fas.envelope} />
                   <span className="contact-item-content"><span>info@aaf.com.in</span></span>
                 </span>
                 <span className="contact-item">
                   <FontAwesomeIcon icon={byPrefixAndName.fas.phone} />
                   <span className="contact-item-content"><span>+216 36 204 600</span></span>
                 </span>
                 <span className="contact-item">
                   <FontAwesomeIcon icon={byPrefixAndName.fas.mapMarkerAlt} />
                   <span className="contact-item-content"><span>Rue de Kairouan , BP65<br/>4013 Messadine - Tunisia</span></span>
                 </span>
               </p>
             </div>
             <div className="contact-form-card">
               <h3 className="contact-form-title">
                 <FontAwesomeIcon icon={byPrefixAndName.fas.envelope} />
                 Envoyez-nous un message
               </h3>
               <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                 <div className="form-group">
                   <label className="form-label" htmlFor="name">Nom et Prénom</label>
                   <input
                     type="text"
                     id="name"
                     name="name"
                     value={formData.name}
                     onChange={handleChange}
                     placeholder="Saisir votre nom et prénom"
                     className="form-input"
                     required
                   />
                 </div>
                 <div className="form-group">
                   <label className="form-label" htmlFor="email">Email</label>
                   <input
                     type="email"
                     id="email"
                     name="email"
                     value={formData.email}
                     onChange={handleChange}
                     placeholder="Saisir votre email"
                     className="form-input"
                     required
                   />
                 </div>
                 <div className="form-group">
                   <label className="form-label" htmlFor="message">Message</label>
                   <textarea
                     id="message"
                     name="message"
                     value={formData.message}
                     onChange={handleChange}
                     placeholder="Saisir votre message..."
                     className="form-textarea"
                     rows="5"
                     required
                   ></textarea>
                 </div>
                 <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                   {isSubmitting ? 'Envoi en cours...' : 'Envoyer'}
                 </button>
                 {status && (
                   <div className={`form-status ${status.includes('succès') ? 'success' : 'error'}`}>
                     {status}
                   </div>
                 )}
               </form>
             </div>
           </div>
         </div>
       </div>
       <Footer />
     </>
   );
};
export default Contact_us;
