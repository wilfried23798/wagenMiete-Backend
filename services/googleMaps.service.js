const { Client } = require("@googlemaps/google-maps-services-js");
const client = new Client({});

class GoogleMapsService {
    constructor() {
        // Chargement des variables d'environnement
        this.baseAddress = process.env.GO_SHUTTLE_BASE_ADDRESS;
        this.apiKey = process.env.GOOGLE_MAPS_API_KEY;

        // Vérification immédiate au démarrage
        if (!this.apiKey) console.error("❌ Erreur: GOOGLE_MAPS_API_KEY manquante dans le .env");
        if (!this.baseAddress) console.error("❌ Erreur: GO_SHUTTLE_BASE_ADDRESS manquante dans le .env");
    }

    /**
     * Calcule la distance entre la base de GO-Shuttle et le client
     * @param {string} destination - L'adresse saisie par le client
     */
    async calculateDistance(destination) {
        try {
            console.log(`🔎 [MapsService] Calcul vers: "${destination}" depuis "${this.baseAddress}"`);

            const response = await client.distancematrix({
                params: {
                    origins: [this.baseAddress],
                    destinations: [destination],
                    key: this.apiKey,
                    mode: 'driving',
                    units: 'metric'
                },
                timeout: 5000 // Évite de bloquer le serveur si Google est lent
            });

            // Log de sécurité pour inspecter la réponse brute en cas de problème
            if (response.data.status !== 'OK') {
                console.error("❌ Erreur API Google:", response.data.error_message || response.data.status);
                throw new Error(`Google API Error: ${response.data.status}`);
            }

            const element = response.data.rows[0].elements[0];

            // Vérification du statut spécifique au trajet (ex: adresse introuvable ou pas de route)
            if (element.status !== 'OK') {
                console.warn(`⚠️ Trajet impossible: ${element.status}`);
                throw new Error(`Impossible de calculer le trajet (${element.status})`);
            }

            const distanceInKm = element.distance.value / 1000;
            const durationText = element.duration.text;

            console.log(`✅ Distance calculée: ${distanceInKm.toFixed(1)} km (${durationText})`);

            return {
                distanceKm: distanceInKm,
                durationText: durationText
            };

        } catch (error) {
            // Log détaillé pour le terminal Node
            console.error("🚨 Erreur critique Google Maps Service:");
            if (error.response) {
                console.error("- Status:", error.response.status);
                console.error("- Data:", JSON.stringify(error.response.data));
            } else {
                console.error("- Message:", error.message);
            }
            throw error; // Propagation vers le contrôleur
        }
    }
}

module.exports = new GoogleMapsService();