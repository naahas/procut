const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { Resend } = require('resend');
require('dotenv').config();

// Initialize Resend avec ta clé API
const resend = new Resend(process.env.RESEND_API_KEY);

// Main constants
const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['Content-Type']
    }
});

// Session middleware
const tmin = 60000;
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
    resave: true,
    saveUninitialized: true,
    cookie: {
        maxAge: 30 * tmin,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    }
});

// Middlewares
app.use(cors());
app.use(express.static('src/html'));
app.use(express.static('src/style'));
app.use(express.static('src/script'));
app.use(express.static('src/img'));
app.use(express.static('src/videos'));
app.use(sessionMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
io.engine.use(sessionMiddleware);

// Routes
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/src/html/home.html');
});

// Socket.IO
io.on('connection', (socket) => {
    console.log("Nouvelle connexion :", socket.id);
    
    // Gestion des contacts/réservations
    socket.on('contact', async (data) => {
        console.log('Nouvelle réservation reçue:', data);

        const servicePrices = {
            'coupe': 20,
            'barbe': 15,
            'coupe-barbe': 30,
            'enfant': 15,
            'autre': 25
        };

        data.servicePrice = data.servicePrice || servicePrices[data.service] || 20;
        data.totalPrice = data.totalPrice || (data.servicePrice + data.travelFees.total);
        
        try {
            // Sauvegarder dans un fichier JSON
            const contactsFile = path.join(__dirname, 'reservations.json');
            let reservations = [];
            
            try {
                const fileContent = await fs.readFile(contactsFile, 'utf-8');
                reservations = JSON.parse(fileContent);
            } catch (err) {
                console.log('Création du fichier de réservations...');
            }
            
            const newReservation = {
                ...data,
                id: `RES-${Date.now()}`,
                socketId: socket.id,
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            
            reservations.push(newReservation);
            await fs.writeFile(contactsFile, JSON.stringify(reservations, null, 2));
            
            // Email HTML pour Marvyn
            const emailHtmlForMarvyn = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
                        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        h2 { color: #DC143C; border-bottom: 2px solid #DC143C; padding-bottom: 10px; }
                        h3 { color: #333; margin-top: 25px; }
                        .detail-row { display: flex; padding: 10px 0; border-bottom: 1px solid #eee; }
                        .label { font-weight: bold; color: #666; min-width: 150px; }
                        .value { color: #333; }
                        .highlight { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        .price { font-size: 24px; color: #DC143C; font-weight: bold; }
                        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>📋 Nouvelle Réservation - 2coupe en coupe</h2>
                        
                        <h3>👤 Informations Client</h3>
                        <div class="detail-row">
                            <span class="label">Nom :</span>
                            <span class="value">${data.name}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Email :</span>
                            <span class="value">${data.email}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Téléphone :</span>
                            <span class="value">${data.phone}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Adresse :</span>
                            <span class="value">${data.address}</span>
                        </div>
                        
                        <h3>✂️ Détails du Service</h3>
                        <div class="detail-row">
                            <span class="label">Service :</span>
                            <span class="value">${data.service.toUpperCase()}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Date/Heure :</span>
                            <span class="value">${data.formattedDate}</span>
                        </div>
                        ${data.message ? `
                        <div class="detail-row">
                            <span class="label">Message :</span>
                            <span class="value">${data.message}</span>
                        </div>
                        ` : ''}
                        
                        <div class="highlight">
                            <h3 style="margin-top: 0;">💰 Tarification</h3>
                            <div class="detail-row">
                                <span class="label">Service :</span>
                                <span class="value">${data.servicePrice}€</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">Déplacement :</span>
                                <span class="value">${data.travelFees.base}€</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">Frais zone :</span>
                                <span class="value">${data.travelFees.zone}€</span>
                            </div>
                            <div class="detail-row" style="border-top: 2px solid #DC143C; margin-top: 10px; padding-top: 10px;">
                                <span class="label">TOTAL :</span>
                                <span class="price">${data.totalPrice}€</span>
                            </div>
                        </div>
                        
                        <div class="footer">
                            ID Réservation : ${newReservation.id}<br>
                            Reçu le ${new Date().toLocaleString('fr-FR')}
                        </div>
                    </div>
                </body>
                </html>
            `;
            
            // Email HTML pour le client
            const emailHtmlForClient = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
                        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #DC143C; }
                        h1 { color: #DC143C; margin: 0; }
                        .subtitle { color: #666; font-size: 14px; margin-top: 5px; }
                        h3 { color: #333; margin-top: 25px; }
                        .detail-row { display: flex; padding: 8px 0; }
                        .label { font-weight: bold; color: #666; min-width: 120px; }
                        .value { color: #333; }
                        .highlight { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #DC143C; }
                        .cta { text-align: center; margin: 30px 0; }
                        .button { display: inline-block; padding: 12px 30px; background: #DC143C; color: white; text-decoration: none; border-radius: 25px; }
                        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>2coupe en coupe</h1>
                            <div class="subtitle">BARBER • SERVICE À DOMICILE</div>
                        </div>
                        
                        <h3>Bonjour ${data.name} 👋</h3>
                        <p>Votre demande de réservation a bien été reçue et transmise à Marvyn !</p>
                        
                        <div class="highlight">
                            <h3 style="margin-top: 0;">📅 Récapitulatif de votre RDV</h3>
                            <div class="detail-row">
                                <span class="label">Service :</span>
                                <span class="value">${data.service.toUpperCase()}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">Date/Heure :</span>
                                <span class="value">${data.formattedDate}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">Adresse :</span>
                                <span class="value">${data.address}</span>
                            </div>
                            <div class="detail-row" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                                <span class="label">Prix total :</span>
                                <span class="value" style="font-size: 20px; color: #DC143C; font-weight: bold;">${data.totalPrice}€</span>
                            </div>
                            <div style="font-size: 12px; color: #666; margin-top: 5px;">
                                (${data.servicePrice}€ service + ${data.travelFees.total}€ déplacement)
                            </div>
                        </div>
                        
                        <h3>✅ Prochaines étapes</h3>
                        <p>
                            Marvyn vous confirmera votre RDV très rapidement au numéro : <strong>${data.phone}</strong><br>
                            Il vous précisera l'heure exacte d'arrivée et répondra à vos éventuelles questions.
                        </p>
                        
                        <h3>📞 Contact</h3>
                        <p>
                            Pour toute modification ou question :<br>
                            📱 <strong>07 83 06 61 56</strong><br>
                            📧 <strong>Marvynbonheur972@gmail.com</strong>
                        </p>
                        
                        <div class="footer">
                            <strong>2coupe en coupe - BARBER</strong><br>
                            Service professionnel à domicile<br>
                            Savigny-le-Temple & environs<br><br>
                            Référence réservation : ${newReservation.id}
                        </div>
                    </div>
                </body>
                </html>
            `;
            
            // IMPORTANT : Configuration de l'envoi d'email
            // Tu dois utiliser une adresse email vérifiée dans Resend
            // Va sur https://resend.com/domains et ajoute ton domaine ou utilise onboarding@resend.dev pour tester
            
            try {
               const { data: emailData1, error: error1 } = await resend.emails.send({
                    from: 'onboarding@resend.dev',
                    to: 'lv9dreams@gmail.com',  // Ton email pour tester
                    subject: `Nouvelle réservation - ${data.name} - ${data.formattedDate}`,
                    html: emailHtmlForMarvyn
                });

                if (error1) {
                    console.error('Erreur envoi email:', error1);
                } else {
                    console.log('Email envoyé:', emailData1);
                }
                
                // if (error1) {
                //     console.error('Erreur envoi email à Marvyn:', error1);
                // } else {
                //     console.log('Email envoyé à Marvyn:', emailData1);
                // }
                
                // Email pour le client
                // const { data: emailData2, error: error2 } = await resend.emails.send({
                //     from: 'onboarding@resend.dev', // CHANGE CECI avec ton domaine vérifié
                //     to: data.email,
                //     subject: 'Confirmation de votre demande de RDV - 2coupe en coupe',
                //     html: emailHtmlForClient
                // });
                
                // if (error2) {
                //     console.error('Erreur envoi email au client:', error2);
                // } else {
                //     console.log('Email envoyé au client:', emailData2);
                // }
                
                // Confirmer au client via socket
                socket.emit('contact-response', { 
                    success: true, 
                    message: 'Réservation confirmée et emails envoyés !' 
                });
                
            } catch (emailError) {
                console.error('Erreur Resend:', emailError);
                
                // Même si l'email échoue, on sauvegarde la réservation
                socket.emit('contact-response', { 
                    success: false, 
                    message: 'Réservation enregistrée mais erreur email. Contactez directement Marvyn.' 
                });
            }
            
        } catch (error) {
            console.error('Erreur générale:', error);
            socket.emit('contact-response', { 
                success: false, 
                message: 'Erreur lors de l\'envoi. Veuillez réessayer.' 
            });
        }
    });
    
    // Envoi de la galerie (si tu as des images stockées)
    socket.on('get-gallery', async () => {
        // Tu peux implémenter la logique pour charger les images depuis un dossier
        // Pour l'instant on renvoie les données par défaut
    });
    
    socket.on('disconnect', () => {
        console.log("Déconnexion :", socket.id);
    });
});

















// Démarrage du serveur
const PORT = process.env.PORT || 7000;
server.listen(PORT, function(err) {
    if (err) throw err;
    console.log("-------------------");
    console.log("server on", PORT);
    console.log("-------------------");
});