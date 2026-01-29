console.log("Extension ScodocPatcher chargée");

function scanPage() {
    console.log("Analyse de la page pour les notes...");

    // Fonction utilitaire pour nettoyer le texte
    const cleanText = (text) => text ? text.trim().replace(/\s+/g, ' ') : '';

    // Stratégie : Trouver tous les éléments susceptibles d'être des en-têtes d'UE ou des lignes de notes
    // Comme nous n'avons pas de classes, nous scannons les conteneurs génériques susceptibles de contenir du texte
    // Nous itérons sur tous les éléments structurels (div, tr, p, li, td)
    const candidates = document.querySelectorAll('div, tr, p, li, td, h1, h2, h3, h4');

    let currentUE = null;
    const structure = [];

    // Concepts Regex
    const ueRegex = /UE\s*\d+(\.\d+)?/i; // Correspond à "UE 3", "UE3.1", "UE 3.2"
    const coefRegex = /Coef\.?\s*(\d+)/i; // Correspond à "Coef. 15", "Coef 4"

    candidates.forEach(element => {
        // Optimisation : Ignorer les éléments avec trop d'enfants pour éviter de re-traiter les parents des enfants trouvés
        // Mais il faut être prudent. Regardons les nœuds feuilles ou les nœuds avec du contenu textuel direct.
        // En fait, une itération simple de haut en bas pourrait compter doublon. 
        // Meilleure stratégie : Chercher les nœuds texte ? 
        // Restons sur l'indication de l'utilisateur : "blocs UE" et "Lignes de Notes".

        const text = cleanText(element.innerText);

        // 1. Vérifier si c'est un Bloc UE
        // Il doit contenir "UE" + nombre. 
        // Pour éviter les faux positifs (comme tout le body), vérifions si le texte générique *commence* par ou constitue la majeure partie du contenu, 
        // ou s'il s'agit d'une cellule d'en-tête spécifique.
        // Heuristique : Texte assez court contenant le motif.
        if (ueRegex.test(text) && text.length < 100) {
            // C'est un potentiel en-tête d'UE.
            // Mais vérifions que nous ne l'avons pas déjà traité via un parent.
            // Pour l'instant, loggons-le simplement.
            const match = text.match(ueRegex);
            currentUE = {
                name: match[0],
                element: element,
                grades: []
            };
            structure.push(currentUE);
            // console.log("UE trouvée :", currentUE.name);
            return; // Ne pas traiter cet élément comme une ligne de note si c'est un en-tête
        }

        // 2. Vérifier si c'est une Ligne de Note
        // Doit avoir "Coef." + nombre.
        if (currentUE && coefRegex.test(text)) {
            // Elle appartient à la dernière UE trouvée.
            // Nous devons vérifier la duplication. Si 'tr' l'a, 'td' dedans pourrait aussi l'avoir.
            // Nous préférons le conteneur qui a à la fois la note et le coef ? 
            // Ou juste la ligne.
            // Stockons-le.

            // Éviter d'ajouter la même ligne visuelle plusieurs fois (ex: TR et TD)
            // Si l'élément est un enfant du dernier élément de note de l'UE actuelle, ignorer ?
            // Déduplication simple : Vérifier si cet élément contient le *même* texte que la dernière note ajoutée ?

            // Acceptons strictement : "Coef." est présent.
            // Nous voulons aussi capturer la note. La note peut être "14.5" ou "~".

            // Extrayons les données brutes
            const coefMatch = text.match(coefRegex);
            const coef = coefMatch ? parseInt(coefMatch[1], 10) : 0;

            // La détection de note est délicate sans sélecteur. C'est "potentiellement une note".
            // Nous chercherons un motif numérique XX.XX ou ~
            // La note est généralement proche du Coef.

            const gradeItem = {
                element: element,
                rawText: text,
                coef: coef
            };

            // Stratégie de déduplication simple :
            // Si cet élément contient le *même* coef et est à l'intérieur de l'élément précédent, 
            // peut-être voulons-nous le plus spécifique (enfant) ou la ligne (parent).
            // L'utilisateur a dit "Lignes de Notes".

            // Ajoutons toute la logique d'implémentation plus tard, pour l'instant collectons juste les "Lignes"
            // Nous filtrons si l'élément est trop grand (comme la table elle-même)
            if (text.length < 200) {
                // Vérifier si nous venons d'ajouter cet élément exact ou un parent
                const lastGrade = currentUE.grades[currentUE.grades.length - 1];
                if (!lastGrade || !lastGrade.element.contains(element)) {
                    currentUE.grades.push(gradeItem);
                }
            }
        }
    });

    console.log("--- Analyse ScodocPatcher ---");
    console.log("Structure Trouvée :", structure);

    // Tableau Console pour une meilleure visibilité
    const exportData = structure.flatMap(ue =>
        ue.grades.map(g => ({
            UE: ue.name,
            Texte: g.rawText.substring(0, 50) + "...",
            Coef: g.coef
        }))
    );
    console.table(exportData);
}

// Lancer quand le DOM est prêt (manifest run_at document_idle gère généralement ça, mais un délai aide pour les SPA)
setTimeout(scanPage, 1000);
