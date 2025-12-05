-- Créer un nouvel utilisateur PostgreSQL pour l'application
-- À exécuter en tant que superuser (postgres)

-- Créer l'utilisateur
CREATE USER picking_user WITH PASSWORD 'picking_password_2024';

-- Donner les droits sur la base de données
GRANT ALL PRIVILEGES ON DATABASE picking_webapp TO picking_user;

-- Se connecter à la base picking_webapp puis exécuter :
-- \c picking_webapp
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO picking_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO picking_user;
