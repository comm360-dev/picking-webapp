# Réinitialiser le mot de passe PostgreSQL sur Windows

## Méthode 1 : Via pgAdmin
1. Ouvre pgAdmin
2. Clic droit sur "PostgreSQL" (serveur)
3. Properties → Connection
4. Change le mot de passe
5. Sauvegarde

## Méthode 2 : Via ligne de commande

1. Trouve le fichier pg_hba.conf (généralement dans C:\Program Files\PostgreSQL\XX\data\)

2. Ouvre-le en tant qu'administrateur avec Notepad

3. Trouve la ligne qui ressemble à :
   ```
   host    all             all             127.0.0.1/32            scram-sha-256
   ```

4. Change "scram-sha-256" en "trust" :
   ```
   host    all             all             127.0.0.1/32            trust
   ```

5. Sauvegarde le fichier

6. Redémarre le service PostgreSQL :
   - Ouvre "Services" (services.msc)
   - Trouve "postgresql-x64-XX"
   - Clic droit → Redémarrer

7. Ouvre un terminal et exécute :
   ```
   psql -U postgres
   ALTER USER postgres WITH PASSWORD 'nouveau_mot_de_passe';
   \q
   ```

8. Retourne dans pg_hba.conf et remets "scram-sha-256"

9. Redémarre à nouveau PostgreSQL

10. Mets à jour backend/.env avec ton nouveau mot de passe
