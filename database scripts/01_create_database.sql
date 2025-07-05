-- =====================================================
-- WebPlayer Database - PostgreSQL Setup Script
-- Versão: 1.0
-- Data: 01/07/2025
-- Descrição: Criação do banco de dados principal
-- =====================================================

-- Criar banco de dados (executar como superuser)
-- CREATE DATABASE webplayer_db 
--     WITH 
--     OWNER = webplayer_user
--     ENCODING = 'UTF8'
--     LC_COLLATE = 'pt_BR.UTF-8'
--     LC_CTYPE = 'pt_BR.UTF-8'
--     TABLESPACE = pg_default
--     CONNECTION LIMIT = -1;

-- Criar usuário específico para a aplicação
-- CREATE USER webplayer_user WITH PASSWORD 'webplayer_secure_password_2025';

-- Conceder privilégios
-- GRANT ALL PRIVILEGES ON DATABASE webplayer_db TO webplayer_user;
-- GRANT CREATE ON SCHEMA public TO webplayer_user;

-- Conectar ao banco webplayer_db antes de executar os próximos scripts
-- \c webplayer_db;

-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Comentários do banco
COMMENT ON DATABASE webplayer_db IS 'Banco de dados do WebPlayer - Sistema de streaming com autenticação e favoritos';

-- Configurações de timezone
SET timezone = 'America/Sao_Paulo';

