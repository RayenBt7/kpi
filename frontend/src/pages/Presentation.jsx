const Presentation = ({ theme = "dark" }) => {
  const isDark = theme === "dark";
  const generalData = [
    "Raison sociale: A.A.F.",
    'Forme juridique: Societe en commandite simple "S.A.R.L".',
    "Date de creation: 23/12/1999",
    "Demarrage de la production: 01/05/2000",
    "Nombre d'employees: 295",
    "Registre de commerce: B11252000",
  ];

  return (
    <div
      className={`min-h-screen pt-16 ${isDark ? "bg-slate-900" : "bg-gray-50"}`}
    >
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div
          className={`rounded-lg shadow-lg p-8 ${
            isDark ? "bg-slate-800 shadow-slate-950/30" : "bg-white"
          }`}
        >
          <h1
            className={`text-4xl font-bold mb-6 text-center ${isDark ? "text-slate-100" : "text-gray-800"}`}
          >
            INTRANET KPI A.A.F
          </h1>
          <p
            className={`text-lg mb-8 text-center ${isDark ? "text-slate-300" : "text-gray-600"}`}
          >
            NOUVEAUTÉ, DOCUMENTATION, INDICATEURS...
          </p>

          <div className="mb-8">
            <h2
              className={`text-2xl font-semibold mb-4 border-b-2 border-blue-500 pb-2 ${
                isDark ? "text-slate-100" : "text-gray-700"
              }`}
            >
              Présentation
            </h2>
            <p
              className={`leading-relaxed mb-4 ${isDark ? "text-slate-300" : "text-gray-600"}`}
            >
              La societe &quot;A.A.F&quot; est une societe de production
              entierement exportatrice.
            </p>
            <p
              className={`leading-relaxed mb-4 ${isDark ? "text-slate-300" : "text-gray-600"}`}
            >
              Elle existe depuis l&apos;an 2000 et, grace a l&apos;engagement et
              a la qualite du travail de l&apos;equipe, la societe s&apos;est
              developpee au fil des annees.
            </p>
            <p
              className={`leading-relaxed mb-4 ${isDark ? "text-slate-300" : "text-gray-600"}`}
            >
              Specialisee dans le domaine de la haute frequence, nos produits
              couvrent tous les types de connexion telematique dans le secteur
              automobile et une variete d&apos;antennes de haute technologie,
              notamment les antennes GPS, les antennes GSM et d&apos;autres
              antennes specifiques.
            </p>
            <h3
              className={`text-xl font-semibold mb-3 ${isDark ? "text-slate-100" : "text-gray-700"}`}
            >
              Donnees generales :
            </h3>
            <ul
              className={`list-disc list-inside space-y-2 ${isDark ? "text-slate-300" : "text-gray-600"}`}
            >
              {generalData.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="mb-8">
            <h3
              className={`text-xl font-semibold mb-3 ${isDark ? "text-slate-100" : "text-gray-700"}`}
            >
              Activites :
            </h3>
            <p
              className={`leading-relaxed ${isDark ? "text-slate-300" : "text-gray-600"}`}
            >
              <strong>Production:</strong> Fabrication de cartes electroniques,
              câblage, assemblage, tests et livraison.
            </p>
            <p
              className={`leading-relaxed mt-2 ${isDark ? "text-slate-300" : "text-gray-600"}`}
            >
              <strong>Conception:</strong> Bureau d&apos;etude et mise en place
              des moyens de production.
            </p>
          </div>

          <div className="mb-8">
            <h3
              className={`text-xl font-semibold mb-3 ${isDark ? "text-slate-100" : "text-gray-700"}`}
            >
              Materiels :
            </h3>
            <p
              className={`leading-relaxed ${isDark ? "text-slate-300" : "text-gray-600"}`}
            >
              Machines CNC, machines de fabrication et de montage des antennes,
              machines de test radio, chaîne de fabrication des engins de
              dissections.
            </p>
          </div>

          <div className="mb-8">
            <h3
              className={`text-xl font-semibold mb-3 ${isDark ? "text-slate-100" : "text-gray-700"}`}
            >
              Personnel :
            </h3>
            <ul
              className={`list-disc list-inside space-y-2 ${isDark ? "text-slate-300" : "text-gray-600"}`}
            >
              <li>235ouviers, 20 cadres, 10 IT, 30ingenieurs</li>
              <li>
                Organisation: Direction, Administration, Production,ingenierie,
                Qualite
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Presentation;
