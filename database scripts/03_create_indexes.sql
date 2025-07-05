-- =====================================================
-- WebPlayer Database - Índices Adicionais
-- Versão: 1.0
-- Data: 01/07/2025
-- Descrição: Índices especializados para performance
-- =====================================================

-- Conectar ao banco webplayer_db
-- \c webplayer_db;

-- =====================================================
-- ÍNDICES COMPOSTOS PARA CONSULTAS FREQUENTES
-- =====================================================

-- Índice composto para busca de favoritos por usuário e tipo
CREATE INDEX idx_favorites_user_type_created ON favorites(user_id, item_type, created_at DESC);

-- Índice composto para busca de favoritos por usuário e gênero
CREATE INDEX idx_favorites_user_genre ON favorites(user_id, genre) WHERE genre IS NOT NULL;

-- Índice composto para busca de favoritos por usuário e ano
CREATE INDEX idx_favorites_user_year ON favorites(user_id, year DESC) WHERE year IS NOT NULL;

-- Índice composto para busca de favoritos por usuário e rating
CREATE INDEX idx_favorites_user_rating ON favorites(user_id, rating DESC) WHERE rating IS NOT NULL;

-- Índice para sessões ativas por usuário
CREATE INDEX idx_user_sessions_user_active ON user_sessions(user_id, is_active, expires_at) 
WHERE is_active = TRUE;

-- Índice para categorias por usuário ordenadas
CREATE INDEX idx_favorite_categories_user_order ON favorite_categories(user_id, sort_order, name);

-- =====================================================
-- ÍNDICES PARA BUSCA TEXTUAL (FULL-TEXT SEARCH)
-- =====================================================

-- Índice GIN para busca textual em títulos e descrições
CREATE INDEX idx_favorites_search_title_desc ON favorites 
USING gin(to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(description, '')));

-- Índice GIN para busca em dados extras (JSONB)
CREATE INDEX idx_favorites_extra_data_gin ON favorites USING gin(extra_data);

-- Índice para busca em preferências de usuário
CREATE INDEX idx_users_preferences_gin ON users USING gin(preferences);

-- =====================================================
-- ÍNDICES PARCIAIS PARA OTIMIZAÇÃO
-- =====================================================

-- Índice apenas para usuários ativos
CREATE INDEX idx_users_active ON users(id, username, email) 
WHERE status = 'active' AND deleted_at IS NULL;

-- Índice apenas para sessões não expiradas
CREATE INDEX idx_user_sessions_valid ON user_sessions(user_id, session_token) 
WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP;

-- Índice apenas para favoritos com rating
CREATE INDEX idx_favorites_with_rating ON favorites(user_id, rating DESC, title) 
WHERE rating IS NOT NULL;

-- Índice apenas para favoritos assistidos recentemente
CREATE INDEX idx_favorites_recently_watched ON favorites(user_id, last_watched DESC) 
WHERE last_watched IS NOT NULL;

-- =====================================================
-- ÍNDICES PARA RELATÓRIOS E ANALYTICS
-- =====================================================

-- Índice para contagem de favoritos por tipo e data
CREATE INDEX idx_favorites_analytics_type_date ON favorites(item_type, date_trunc('day', created_at));

-- Índice para contagem de usuários por data de criação
CREATE INDEX idx_users_analytics_date ON users(date_trunc('day', created_at)) 
WHERE deleted_at IS NULL;

-- Índice para análise de atividade por IP
CREATE INDEX idx_user_sessions_ip_date ON user_sessions(ip_address, date_trunc('day', created_at));

-- Índice para análise de atividade por user agent
CREATE INDEX idx_user_sessions_device_type ON user_sessions(session_type, date_trunc('day', created_at));

-- =====================================================
-- ÍNDICES PARA AUDITORIA E LOGS
-- =====================================================

-- Índice para logs de atividade por usuário e data
CREATE INDEX idx_activity_log_user_date ON user_activity_log(user_id, date_trunc('day', created_at));

-- Índice para logs de atividade por tipo
CREATE INDEX idx_activity_log_type_date ON user_activity_log(activity_type, created_at DESC);

-- Índice para logs de atividade por entidade
CREATE INDEX idx_activity_log_entity_date ON user_activity_log(entity_type, entity_id, created_at DESC);

-- =====================================================
-- ÍNDICES ÚNICOS ADICIONAIS
-- =====================================================

-- Garantir unicidade de email verificado
CREATE UNIQUE INDEX idx_users_verified_email ON users(email) 
WHERE email_verified = TRUE AND deleted_at IS NULL;

-- Garantir unicidade de username ativo
CREATE UNIQUE INDEX idx_users_active_username ON users(username) 
WHERE status = 'active' AND deleted_at IS NULL;

-- =====================================================
-- COMENTÁRIOS DOS ÍNDICES
-- =====================================================

COMMENT ON INDEX idx_favorites_user_type_created IS 'Índice otimizado para listagem de favoritos por usuário e tipo';
COMMENT ON INDEX idx_favorites_search_title_desc IS 'Índice para busca textual em títulos e descrições';
COMMENT ON INDEX idx_favorites_extra_data_gin IS 'Índice para consultas em metadados JSON';
COMMENT ON INDEX idx_users_active IS 'Índice parcial apenas para usuários ativos';
COMMENT ON INDEX idx_user_sessions_valid IS 'Índice parcial apenas para sessões válidas';
COMMENT ON INDEX idx_favorites_analytics_type_date IS 'Índice para relatórios de favoritos por tipo e data';

-- =====================================================
-- ESTATÍSTICAS E ANÁLISE DE PERFORMANCE
-- =====================================================

-- Atualizar estatísticas das tabelas para otimização do query planner
ANALYZE users;
ANALYZE user_sessions;
ANALYZE favorites;
ANALYZE favorite_categories;
ANALYZE favorite_category_items;
ANALYZE user_activity_log;
ANALYZE system_settings;

