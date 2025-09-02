// Socket.io connection
const socket = io();

var app = new Vue({
    el: '#app',
    
    data: function() {
        return {
            scrolled: false,
            mobileMenuOpen: false,
            modalItem: null,
            darkMode: false, // Mode sombre désactivé par défaut
            
            // Services disponibles (prix de base SANS déplacement)
            services: [
                
                // {
                //     id: 2,
                //     icon: 'fas fa-magic',
                //     title: 'DÉGRADÉ',
                //     description: 'Fade moderne, low fade, high fade, taper fade',
                //     price: '25€'
                // },
                {
                    id: 3,
                    icon: 'fas fa-user-tie',
                    title: 'BARBE & MOUSTACHE',
                    description: 'Taille, rasage traditionnel et entretien',
                    price: '15€'
                },
                {
                    id: 1,
                    icon: 'fas fa-cut',
                    title: 'COUPE CLASSIQUE',
                    description: 'Coupe traditionnelle avec finitions précises',
                    price: '20€'
                },
                // {
                //     id: 4,
                //     icon: 'fas fa-paint-brush',
                //     title: 'DESIGNS & TRACÉS',
                //     description: 'Motifs personnalisés et tracés artistiques',
                //     price: '30€'
                // },
                {
                    id: 5,
                    icon: 'fas fa-child',
                    title: 'KIDS',
                    description: 'Coupes enfants avec patience et créativité',
                    price: '15€'
                },
                // {
                //     id: 6,
                //     icon: 'fas fa-crown',
                //     title: 'EXPÉRIENCE VIP',
                //     description: 'Service premium avec soins exclusifs',
                //     price: 'Sur devis'
                // }
            ],
            
            // Galerie (à remplacer par les vraies images/vidéos)
            galleryItems: [
                // Placeholders - remplace avec les vraies URLs
                { type: 'image', url: 'coupe1.jpg' },
                { type: 'image', url: 'coupe2.jpg' },
                { type: 'video', url: 'client1.mp4' },
                { type: 'image', url: 'coupe3.jpg' },
                { type: 'image', url: 'coupe4.jpg' },
                { type: 'video', url: 'client2.mp4' },
                { type: 'image', url: 'coupe5.jpg' },
                { type: 'image', url: 'coupe6.jpg' },
                { type: 'video', url: 'client3.mp4' }
            ],
            
            // Célébrités
            celebrities: [
                { username: '@stony.sp' },
                { username: '@jungeli' },
                { username: '@youkaoff' },
                { username: '@ogshaaark' },
                { username: '@davs_os' },
                { username: '@samsy_baz' },
                { username: '@mk_offf_' }
            ],
            
            // Formulaire de contact
            contactForm: {
                name: '',
                phone: '',
                address: '',
                service: '',
                datetime: '',
                message: ''
            },
            
            // Zones de déplacement
            serviceZones: {
                free: ['Savigny-le-Temple', 'Cesson', 'Nandy'],  // Zone proche: +0€
                paid10: ['Melun', 'Lieusaint', 'Moissy-Cramayel', 'Combs-la-Ville', 'Vert-Saint-Denis', 'Brie-Comte-Robert'] // Zone éloignée: +10€
            },
            
            // Tarifs fixes
            baseTravelFee: 15, // Frais de déplacement de base
            extraZoneFee: 10   // Frais supplémentaires pour zone éloignée
        }
    },

    methods: {
        // Toggle Dark Mode
        toggleTheme() {
            this.darkMode = !this.darkMode;
            // Sauvegarder la préférence dans localStorage
            localStorage.setItem('darkMode', this.darkMode);
        },
        
        // Gestion du scroll
        handleScroll() {
            this.scrolled = window.scrollY > 50;
        },
        
        // Lecture/pause vidéo au survol - maintenant juste pour assurer la lecture
        playVideo(event) {
            if (event.target.tagName === 'VIDEO') {
                event.target.play();
            }
        },
        
        pauseVideo(event) {
            // On ne met plus en pause, les vidéos tournent en boucle
            if (event.target.tagName === 'VIDEO') {
                event.target.play();
            }
        },
        
        // Initialiser toutes les vidéos pour autoplay
        initVideos() {
            setTimeout(() => {
                const videos = document.querySelectorAll('.gallery-item video');
                videos.forEach(video => {
                    video.muted = true;
                    video.play().catch(e => {
                        console.log('Autoplay prevented:', e);
                        // Fallback: essayer de jouer au premier clic/interaction
                        document.addEventListener('click', () => {
                            video.play();
                        }, { once: true });
                    });
                });
            }, 500);
        },
        
        // Modal galerie
        openModal(item) {
            this.modalItem = item;
            document.body.style.overflow = 'hidden';
        },
        
        closeModal() {
            this.modalItem = null;
            document.body.style.overflow = 'auto';
        },
        
        // Gestion du formulaire de contact
        handleContact() {
            // Validation basique
            if (!this.contactForm.name || !this.contactForm.phone || !this.contactForm.address || !this.contactForm.service || !this.contactForm.datetime) {
                alert('Veuillez remplir tous les champs obligatoires');
                return;
            }
            
            // Formatage de la date
            const date = new Date(this.contactForm.datetime);
            const formattedDate = date.toLocaleString('fr-FR');
            
            // Calcul des frais
            const travelFees = this.calculateTravelFee(this.contactForm.address);
            
            // Envoi via socket.io
            socket.emit('contact', {
                ...this.contactForm,
                formattedDate: formattedDate,
                travelFees: travelFees,
                timestamp: new Date().toISOString()
            });
            
            // Message de confirmation avec détail des frais
            alert(`Merci ${this.contactForm.name} !\n\nRécapitulatif de votre RDV :\n` +
                  `📍 Service : ${this.contactForm.service}\n` +
                  `📅 Date : ${formattedDate}\n` +
                  `🏠 Adresse : ${this.contactForm.address}\n` +
                  `💰 Frais de déplacement : ${travelFees.description}\n\n` +
                  `Marvyn vous confirmera rapidement au ${this.contactForm.phone}`);
            
            // Reset du formulaire
            this.contactForm = {
                name: '',
                phone: '',
                address: '',
                service: '',
                datetime: '',
                message: ''
            };
        },
        
        // Calculer les frais de déplacement
        calculateTravelFee(address) {
            // Logique simplifiée - à améliorer avec une vraie API de géolocalisation
            const lowerAddress = address.toLowerCase();
            let zoneFee = 0;
            let zoneType = 'zone éloignée';
            
            // Vérifier si c'est une zone proche (gratuite)
            for (let zone of this.serviceZones.free) {
                if (lowerAddress.includes(zone.toLowerCase())) {
                    zoneFee = 0;
                    zoneType = 'zone proche';
                    break;
                }
            }
            
            // Vérifier si c'est une zone éloignée (+10€)
            for (let zone of this.serviceZones.paid10) {
                if (lowerAddress.includes(zone.toLowerCase())) {
                    zoneFee = this.extraZoneFee;
                    zoneType = 'zone éloignée';
                    break;
                }
            }
            
            // Calcul total: 15€ de base + frais de zone
            const totalTravelFee = this.baseTravelFee + zoneFee;
            
            return {
                base: this.baseTravelFee,
                zone: zoneFee,
                total: totalTravelFee,
                description: `15€ déplacement + ${zoneFee}€ (${zoneType})`
            };
        },
        
        // Calculer le prix total
        calculateTotalPrice(servicePrice, address) {
            const travelFees = this.calculateTravelFee(address);
            const service = parseInt(servicePrice) || 0;
            return {
                service: service,
                travel: travelFees.total,
                total: service + travelFees.total,
                details: travelFees.description
            };
        },
        
        // Smooth scroll pour les liens d'ancrage
        initSmoothScroll() {
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', function(e) {
                    e.preventDefault();
                    const target = document.querySelector(this.getAttribute('href'));
                    if (target) {
                        target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                });
            });
        },
        
        // Animation au scroll (intersection observer)
        initScrollAnimations() {
            const observerOptions = {
                threshold: 0.1,
                rootMargin: '0px 0px -100px 0px'
            };
            
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animated');
                    }
                });
            }, observerOptions);
            
            // Observer les sections
            document.querySelectorAll('section').forEach(section => {
                observer.observe(section);
            });
            
            // Observer les cartes
            document.querySelectorAll('.service-card, .gallery-item, .celebrity-card').forEach(card => {
                observer.observe(card);
            });
        },
        
        // Chargement des images/vidéos depuis le serveur
        loadGallery() {
            // À implémenter : récupération des médias depuis le serveur
            socket.emit('get-gallery');
        },
        
        // Effet de parallaxe sur le hero
        initParallax() {
            window.addEventListener('scroll', () => {
                const scrolled = window.pageYOffset;
                const heroBackground = document.querySelector('.hero-background');
                if (heroBackground) {
                    heroBackground.style.transform = `translateY(${scrolled * 0.5}px)`;
                }
            });
        }
    },

    mounted: function() {
        // Charger la préférence du mode sombre
        const savedDarkMode = localStorage.getItem('darkMode');
        if (savedDarkMode !== null) {
            this.darkMode = savedDarkMode === 'true';
        }
        
        // Initialisation des événements
        window.addEventListener('scroll', this.handleScroll);
        this.initSmoothScroll();
        this.initScrollAnimations();
        this.initParallax();
        this.initVideos(); // Initialiser les vidéos
        
        // Chargement des données
        this.loadGallery();
        
        // Socket.io listeners
        socket.on('connect', () => {
            console.log('Connected to server');
        });
        
        socket.on('gallery-data', (data) => {
            if (data && data.items) {
                this.galleryItems = data.items;
                // Réinitialiser les vidéos après chargement de la galerie
                this.$nextTick(() => {
                    this.initVideos();
                });
            }
        });
        
        socket.on('contact-response', (response) => {
            if (response.success) {
                alert(`✅ Réservation confirmée !\n\nUn email de confirmation a été envoyé à Marvyn.\nIl vous recontactera rapidement.`);
                
                // Reset du formulaire seulement si succès
                this.contactForm = {
                    name: '',
                    phone: '',
                    address: '',
                    service: '',
                    datetime: '',
                    message: ''
                };
            } else {
                alert(`❌ Erreur lors de l'envoi.\n\nVeuillez réessayer ou contacter directement Marvyn au 07 83 06 61 56`);
            }
        });
        
        // Fermeture du menu mobile au click en dehors
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.navbar')) {
                this.mobileMenuOpen = false;
            }
        });
        
        // Animation du texte au chargement
        setTimeout(() => {
            document.querySelectorAll('.hero-title .title-line').forEach((line, index) => {
                line.style.animation = `fadeInUp 0.8s ease ${index * 0.2}s both`;
            });
        }, 100);
    },
    
    beforeDestroy() {
        window.removeEventListener('scroll', this.handleScroll);
    }
});