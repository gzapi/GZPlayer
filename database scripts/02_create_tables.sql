-- =====================================================
-- WebPlayer Database - Tabelas Principais
-- Versão: 1.0
-- Data: 01/07/2025
-- Descrição: Criação de todas as tabelas do sistema
-- =====================================================

-- Conectar ao banco webplayer_db
-- \c webplayer_db;

-- =====================================================
-- ENUMS E TIPOS CUSTOMIZADOS
-- =====================================================

-- Tipo para itens de favoritos
CREATE TYPE item_type_enum AS ENUM ('channel', 'movie', 'series');

-- Tipo para status de usuário
CREATE TYPE user_status_enum AS ENUM ('active', 'inactive', 'suspended', 'pending');

-- Tipo para tipos de sessão
CREATE TYPE session_type_enum AS ENUM ('web', 'mobile', 'desktop', 'api');

-- =====================================================
-- TABELA: users
-- Descrição: Armazena dados dos usuários do sistema
-- =====================================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    username VARCHAR(80) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    status user_status_enum DEFAULT 'active' NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE NOT NULL,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    login_attempts INTEGER DEFAULT 0 NOT NULL,
    locked_until TIMESTAMP WITH TIME ZONE,
    preferences JSONB DEFAULT '{}' NOT NULL,
    avatar_url VARCHAR(500),
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    language VARCHAR(10) DEFAULT 'pt-BR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Índices para a tabela users
CREATE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_uuid ON users(uuid);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_email_verification ON users(email_verification_token) WHERE email_verification_token IS NOT NULL;
CREATE INDEX idx_users_password_reset ON users(password_reset_token) WHERE password_reset_token IS NOT NULL;

-- Comentários da tabela users
COMMENT ON TABLE users IS 'Tabela principal de usuários do sistema';
COMMENT ON COLUMN users.uuid IS 'Identificador único universal do usuário';
COMMENT ON COLUMN users.username IS 'Nome de usuário único para login';
COMMENT ON COLUMN users.email IS 'Email único do usuário';
COMMENT ON COLUMN users.password_hash IS 'Hash da senha usando bcrypt';
COMMENT ON COLUMN users.status IS 'Status atual do usuário no sistema';
COMMENT ON COLUMN users.preferences IS 'Preferências do usuário em formato JSON';
COMMENT ON COLUMN users.login_attempts IS 'Contador de tentativas de login falhadas';
COMMENT ON COLUMN users.locked_until IS 'Data até quando a conta está bloqueada';

-- =====================================================
-- TABELA: user_sessions
-- Descrição: Controle de sessões
-- =====================================================

CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(500) UNIQUE NOT NULL,
    refresh_token VARCHAR(500) UNIQUE,
    session_type session_type_enum DEFAULT 'web' NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    user_agent TEXT,
    ip_address INET,
    device_info JSONB DEFAULT '{}',
    location_info JSONB DEFAULT '{}',
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Índices para a tabela user_sessions
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_refresh_token ON user_sessions(refresh_token) WHERE refresh_token IS NOT NULL;
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active, expires_at);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_ip ON user_sessions(ip_address);
CREATE INDEX idx_user_sessions_last_activity ON user_sessions(last_activity);

-- Comentários da tabela user_sessions
COMMENT ON TABLE user_sessions IS 'Controle de sessões ativas dos usuários';
COMMENT ON COLUMN user_sessions.session_token IS 'Token de acesso';
COMMENT ON COLUMN user_sessions.refresh_token IS 'Token para renovação do acesso';
COMMENT ON COLUMN user_sessions.device_info IS 'Informações do dispositivo em JSON';
COMMENT ON COLUMN user_sessions.location_info IS 'Informações de localização em JSON';

-- =====================================================
-- TABELA: favorite_categories
-- Descrição: Categorias personalizadas de favoritos
-- =====================================================

CREATE TABLE favorite_categories (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7), -- Hex color code
    icon VARCHAR(50), -- Material icon name
    sort_order INTEGER DEFAULT 0 NOT NULL,
    is_default BOOLEAN DEFAULT FALSE NOT NULL,
    is_public BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Constraint para evitar duplicatas de nome por usuário
    CONSTRAINT unique_user_category UNIQUE (user_id, name)
);

-- Índices para a tabela favorite_categories
CREATE INDEX idx_favorite_categories_user_id ON favorite_categories(user_id);
CREATE INDEX idx_favorite_categories_name ON favorite_categories(name);
CREATE INDEX idx_favorite_categories_sort_order ON favorite_categories(sort_order);
CREATE INDEX idx_favorite_categories_public ON favorite_categories(is_public) WHERE is_public = TRUE;

-- Comentários da tabela favorite_categories
COMMENT ON TABLE favorite_categories IS 'Categorias personalizadas para organizar favoritos';
COMMENT ON COLUMN favorite_categories.color IS 'Cor da categoria em formato hexadecimal (#RRGGBB)';
COMMENT ON COLUMN favorite_categories.icon IS 'Nome do ícone Material Design';
COMMENT ON COLUMN favorite_categories.sort_order IS 'Ordem de exibição das categorias';
COMMENT ON COLUMN favorite_categories.is_public IS 'Se a categoria pode ser vista por outros usuários';

-- =====================================================
-- TABELA: favorites
-- Descrição: Itens favoritos dos usuários
-- =====================================================

CREATE TABLE favorites (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id VARCHAR(255) NOT NULL,
    item_type item_type_enum NOT NULL,
    
    -- Dados do item favorito (cache local)
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    description TEXT,
    image_url VARCHAR(500),
    url VARCHAR(500),
    genre VARCHAR(100),
    duration INTEGER, -- em minutos
    seasons INTEGER, -- para séries
    episodes INTEGER, -- total de episódios
    year INTEGER,
    rating DECIMAL(3,1), -- 0.0 a 10.0
    imdb_id VARCHAR(20),
    tmdb_id INTEGER,
    
    -- Metadados adicionais
    extra_data JSONB DEFAULT '{}' NOT NULL,
    
    -- Informações de sincronização
    sync_status VARCHAR(20) DEFAULT 'synced' NOT NULL,
    last_watched TIMESTAMP WITH TIME ZONE,
    watch_progress INTEGER DEFAULT 0, -- em segundos
    watch_count INTEGER DEFAULT 0 NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Constraint para evitar duplicatas
    CONSTRAINT unique_user_favorite UNIQUE (user_id, item_id, item_type)
);

-- Índices para a tabela favorites
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_item_type ON favorites(item_type);
CREATE INDEX idx_favorites_genre ON favorites(genre) WHERE genre IS NOT NULL;
CREATE INDEX idx_favorites_year ON favorites(year) WHERE year IS NOT NULL;
CREATE INDEX idx_favorites_rating ON favorites(rating) WHERE rating IS NOT NULL;
CREATE INDEX idx_favorites_title ON favorites USING gin(to_tsvector('portuguese', title));
CREATE INDEX idx_favorites_description ON favorites USING gin(to_tsvector('portuguese', description)) WHERE description IS NOT NULL;
CREATE INDEX idx_favorites_created_at ON favorites(created_at);
CREATE INDEX idx_favorites_last_watched ON favorites(last_watched) WHERE last_watched IS NOT NULL;
CREATE INDEX idx_favorites_sync_status ON favorites(sync_status);
CREATE INDEX idx_favorites_extra_data ON favorites USING gin(extra_data);

-- Comentários da tabela favorites
COMMENT ON TABLE favorites IS 'Itens favoritos dos usuários com cache de metadados';
COMMENT ON COLUMN favorites.item_id IS 'Identificador único do item na fonte original';
COMMENT ON COLUMN favorites.duration IS 'Duração em minutos (para filmes)';
COMMENT ON COLUMN favorites.seasons IS 'Número de temporadas (para séries)';
COMMENT ON COLUMN favorites.episodes IS 'Número total de episódios (para séries)';
COMMENT ON COLUMN favorites.rating IS 'Avaliação de 0.0 a 10.0';
COMMENT ON COLUMN favorites.extra_data IS 'Metadados adicionais em formato JSON';
COMMENT ON COLUMN favorites.watch_progress IS 'Progresso de visualização em segundos';
COMMENT ON COLUMN favorites.watch_count IS 'Número de vezes que foi assistido';

-- =====================================================
-- TABELA: favorite_category_items
-- Descrição: Relacionamento many-to-many entre favoritos e categorias
-- =====================================================

CREATE TABLE favorite_category_items (
    id SERIAL PRIMARY KEY,
    favorite_id INTEGER NOT NULL REFERENCES favorites(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES favorite_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Constraint para evitar duplicatas
    CONSTRAINT unique_favorite_category UNIQUE (favorite_id, category_id)
);

-- Índices para a tabela favorite_category_items
CREATE INDEX idx_favorite_category_items_favorite_id ON favorite_category_items(favorite_id);
CREATE INDEX idx_favorite_category_items_category_id ON favorite_category_items(category_id);

-- Comentários da tabela favorite_category_items
COMMENT ON TABLE favorite_category_items IS 'Relacionamento entre favoritos e categorias (many-to-many)';

-- =====================================================
-- TABELA: user_activity_log
-- Descrição: Log de atividades dos usuários
-- =====================================================

CREATE TABLE user_activity_log (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_id INTEGER REFERENCES user_sessions(id) ON DELETE SET NULL,
    activity_type VARCHAR(50) NOT NULL,
    activity_description TEXT,
    entity_type VARCHAR(50), -- 'favorite', 'user', 'session', etc.
    entity_id INTEGER,
    ip_address INET,
    user_agent TEXT,
    extra_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Índices para a tabela user_activity_log
CREATE INDEX idx_user_activity_log_user_id ON user_activity_log(user_id);
CREATE INDEX idx_user_activity_log_session_id ON user_activity_log(session_id);
CREATE INDEX idx_user_activity_log_activity_type ON user_activity_log(activity_type);
CREATE INDEX idx_user_activity_log_created_at ON user_activity_log(created_at);
CREATE INDEX idx_user_activity_log_entity ON user_activity_log(entity_type, entity_id);

-- Comentários da tabela user_activity_log
COMMENT ON TABLE user_activity_log IS 'Log de atividades dos usuários para auditoria';
COMMENT ON COLUMN user_activity_log.activity_type IS 'Tipo de atividade (login, logout, add_favorite, etc.)';
COMMENT ON COLUMN user_activity_log.entity_type IS 'Tipo de entidade afetada pela atividade';
COMMENT ON COLUMN user_activity_log.entity_id IS 'ID da entidade afetada';

-- =====================================================
-- TABELA: system_settings
-- Descrição: Configurações globais do sistema
-- =====================================================

CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    value_type VARCHAR(20) DEFAULT 'string' NOT NULL, -- string, integer, boolean, json
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Índices para a tabela system_settings
CREATE INDEX idx_system_settings_key ON system_settings(key);
CREATE INDEX idx_system_settings_public ON system_settings(is_public) WHERE is_public = TRUE;

-- Comentários da tabela system_settings
COMMENT ON TABLE system_settings IS 'Configurações globais do sistema';
COMMENT ON COLUMN system_settings.value_type IS 'Tipo do valor para conversão adequada';
COMMENT ON COLUMN system_settings.is_public IS 'Se a configuração pode ser acessada publicamente';

-- =====================================================
-- TRIGGERS PARA UPDATED_AT
-- =====================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger em todas as tabelas com updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_sessions_updated_at BEFORE UPDATE ON user_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_favorite_categories_updated_at BEFORE UPDATE ON favorite_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_favorites_updated_at BEFORE UPDATE ON favorites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS ÚTEIS
-- =====================================================

-- View para estatísticas de usuários
CREATE VIEW user_stats AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.status,
    u.created_at,
    u.last_login,
    COUNT(f.id) as total_favorites,
    COUNT(CASE WHEN f.item_type = 'movie' THEN 1 END) as movie_favorites,
    COUNT(CASE WHEN f.item_type = 'series' THEN 1 END) as series_favorites,
    COUNT(CASE WHEN f.item_type = 'channel' THEN 1 END) as channel_favorites,
    COUNT(DISTINCT fc.id) as total_categories,
    COUNT(CASE WHEN us.is_active = true THEN 1 END) as active_sessions
FROM users u
LEFT JOIN favorites f ON u.id = f.user_id
LEFT JOIN favorite_categories fc ON u.id = fc.user_id
LEFT JOIN user_sessions us ON u.id = us.user_id AND us.expires_at > CURRENT_TIMESTAMP
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.username, u.email, u.status, u.created_at, u.last_login;

-- View para favoritos com informações de categoria
CREATE VIEW favorites_with_categories AS
SELECT 
    f.*,
    COALESCE(
        json_agg(
            json_build_object(
                'id', fc.id,
                'name', fc.name,
                'color', fc.color,
                'icon', fc.icon
            )
        ) FILTER (WHERE fc.id IS NOT NULL),
        '[]'::json
    ) as categories
FROM favorites f
LEFT JOIN favorite_category_items fci ON f.id = fci.favorite_id
LEFT JOIN favorite_categories fc ON fci.category_id = fc.id
GROUP BY f.id;

-- Comentários das views
COMMENT ON VIEW user_stats IS 'Estatísticas consolidadas dos usuários';
COMMENT ON VIEW favorites_with_categories IS 'Favoritos com suas categorias associadas';

