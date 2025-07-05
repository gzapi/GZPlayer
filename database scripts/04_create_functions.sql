-- =====================================================
-- WebPlayer Database - Funções e Procedures
-- Versão: 1.0
-- Data: 01/07/2025
-- Descrição: Funções úteis para o sistema
-- =====================================================

-- Conectar ao banco webplayer_db
-- \c webplayer_db;

-- =====================================================
-- FUNÇÕES DE UTILIDADE GERAL
-- =====================================================

-- Função para gerar slug a partir de texto
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN lower(
        regexp_replace(
            regexp_replace(
                regexp_replace(
                    unaccent(trim(input_text)),
                    '[^a-zA-Z0-9\s-]', '', 'g'
                ),
                '\s+', '-', 'g'
            ),
            '-+', '-', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para validar email
CREATE OR REPLACE FUNCTION is_valid_email(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para validar senha forte
CREATE OR REPLACE FUNCTION is_strong_password(password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN length(password) >= 8 
        AND password ~ '[A-Z]'  -- pelo menos uma maiúscula
        AND password ~ '[a-z]'  -- pelo menos uma minúscula
        AND password ~ '[0-9]'; -- pelo menos um número
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- FUNÇÕES PARA GESTÃO DE USUÁRIOS
-- =====================================================

-- Função para criar usuário completo
CREATE OR REPLACE FUNCTION create_user(
    p_username VARCHAR(80),
    p_email VARCHAR(120),
    p_password_hash VARCHAR(255),
    p_first_name VARCHAR(50) DEFAULT NULL,
    p_last_name VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE(
    user_id INTEGER,
    user_uuid UUID,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_user_id INTEGER;
    v_user_uuid UUID;
BEGIN
    -- Validar email
    IF NOT is_valid_email(p_email) THEN
        RETURN QUERY SELECT NULL::INTEGER, NULL::UUID, FALSE, 'Email inválido';
        RETURN;
    END IF;
    
    -- Verificar se username já existe
    IF EXISTS (SELECT 1 FROM users WHERE username = p_username AND deleted_at IS NULL) THEN
        RETURN QUERY SELECT NULL::INTEGER, NULL::UUID, FALSE, 'Nome de usuário já existe';
        RETURN;
    END IF;
    
    -- Verificar se email já existe
    IF EXISTS (SELECT 1 FROM users WHERE email = p_email AND deleted_at IS NULL) THEN
        RETURN QUERY SELECT NULL::INTEGER, NULL::UUID, FALSE, 'Email já está em uso';
        RETURN;
    END IF;
    
    -- Inserir usuário
    INSERT INTO users (username, email, password_hash, first_name, last_name)
    VALUES (p_username, p_email, p_password_hash, p_first_name, p_last_name)
    RETURNING id, uuid INTO v_user_id, v_user_uuid;
    
    -- Criar categorias padrão para o usuário
    PERFORM create_default_categories(v_user_id);
    
    -- Log da atividade
    INSERT INTO user_activity_log (user_id, activity_type, activity_description)
    VALUES (v_user_id, 'user_created', 'Usuário criado no sistema');
    
    RETURN QUERY SELECT v_user_id, v_user_uuid, TRUE, 'Usuário criado com sucesso';
END;
$$ LANGUAGE plpgsql;

-- Função para criar categorias padrão
CREATE OR REPLACE FUNCTION create_default_categories(p_user_id INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO favorite_categories (user_id, name, description, color, icon, sort_order, is_default)
    VALUES 
        (p_user_id, 'Filmes', 'Meus filmes favoritos', '#E91E63', 'movie', 1, TRUE),
        (p_user_id, 'Séries', 'Minhas séries favoritas', '#9C27B0', 'tv', 2, TRUE),
        (p_user_id, 'Canais', 'Meus canais favoritos', '#2196F3', 'live_tv', 3, TRUE),
        (p_user_id, 'Assistir Depois', 'Para assistir mais tarde', '#FF9800', 'watch_later', 4, TRUE);
END;
$$ LANGUAGE plpgsql;

-- Função para soft delete de usuário
CREATE OR REPLACE FUNCTION soft_delete_user(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE users 
    SET deleted_at = CURRENT_TIMESTAMP,
        status = 'inactive',
        email = email || '_deleted_' || extract(epoch from CURRENT_TIMESTAMP)::text,
        username = username || '_deleted_' || extract(epoch from CURRENT_TIMESTAMP)::text
    WHERE id = p_user_id AND deleted_at IS NULL;
    
    -- Desativar todas as sessões
    UPDATE user_sessions 
    SET is_active = FALSE 
    WHERE user_id = p_user_id;
    
    -- Log da atividade
    INSERT INTO user_activity_log (user_id, activity_type, activity_description)
    VALUES (p_user_id, 'user_deleted', 'Usuário removido do sistema');
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNÇÕES PARA GESTÃO DE FAVORITOS
-- =====================================================

-- Função para adicionar favorito
CREATE OR REPLACE FUNCTION add_favorite(
    p_user_id INTEGER,
    p_item_id VARCHAR(255),
    p_item_type item_type_enum,
    p_title VARCHAR(255),
    p_description TEXT DEFAULT NULL,
    p_image_url VARCHAR(500) DEFAULT NULL,
    p_url VARCHAR(500) DEFAULT NULL,
    p_genre VARCHAR(100) DEFAULT NULL,
    p_duration INTEGER DEFAULT NULL,
    p_seasons INTEGER DEFAULT NULL,
    p_episodes INTEGER DEFAULT NULL,
    p_year INTEGER DEFAULT NULL,
    p_rating DECIMAL(3,1) DEFAULT NULL,
    p_extra_data JSONB DEFAULT '{}'
)
RETURNS TABLE(
    favorite_id INTEGER,
    favorite_uuid UUID,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_favorite_id INTEGER;
    v_favorite_uuid UUID;
BEGIN
    -- Verificar se já existe
    IF EXISTS (
        SELECT 1 FROM favorites 
        WHERE user_id = p_user_id AND item_id = p_item_id AND item_type = p_item_type
    ) THEN
        RETURN QUERY SELECT NULL::INTEGER, NULL::UUID, FALSE, 'Item já está nos favoritos';
        RETURN;
    END IF;
    
    -- Inserir favorito
    INSERT INTO favorites (
        user_id, item_id, item_type, title, description, image_url, url,
        genre, duration, seasons, episodes, year, rating, extra_data
    )
    VALUES (
        p_user_id, p_item_id, p_item_type, p_title, p_description, p_image_url, p_url,
        p_genre, p_duration, p_seasons, p_episodes, p_year, p_rating, p_extra_data
    )
    RETURNING id, uuid INTO v_favorite_id, v_favorite_uuid;
    
    -- Log da atividade
    INSERT INTO user_activity_log (
        user_id, activity_type, activity_description, entity_type, entity_id
    )
    VALUES (
        p_user_id, 'favorite_added', 'Item adicionado aos favoritos: ' || p_title, 
        'favorite', v_favorite_id
    );
    
    RETURN QUERY SELECT v_favorite_id, v_favorite_uuid, TRUE, 'Item adicionado aos favoritos';
END;
$$ LANGUAGE plpgsql;

-- Função para remover favorito
CREATE OR REPLACE FUNCTION remove_favorite(p_user_id INTEGER, p_favorite_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_title VARCHAR(255);
BEGIN
    -- Buscar título para log
    SELECT title INTO v_title FROM favorites 
    WHERE id = p_favorite_id AND user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Remover das categorias
    DELETE FROM favorite_category_items WHERE favorite_id = p_favorite_id;
    
    -- Remover favorito
    DELETE FROM favorites WHERE id = p_favorite_id AND user_id = p_user_id;
    
    -- Log da atividade
    INSERT INTO user_activity_log (
        user_id, activity_type, activity_description, entity_type, entity_id
    )
    VALUES (
        p_user_id, 'favorite_removed', 'Item removido dos favoritos: ' || v_title, 
        'favorite', p_favorite_id
    );
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNÇÕES PARA GESTÃO DE SESSÕES
-- =====================================================

-- Função para limpar sessões expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Marcar sessões expiradas como inativas
    UPDATE user_sessions 
    SET is_active = FALSE 
    WHERE expires_at < CURRENT_TIMESTAMP AND is_active = TRUE;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Remover sessões muito antigas (mais de 90 dias)
    DELETE FROM user_sessions 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Função para invalidar todas as sessões de um usuário
CREATE OR REPLACE FUNCTION invalidate_user_sessions(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE user_sessions 
    SET is_active = FALSE 
    WHERE user_id = p_user_id AND is_active = TRUE;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Log da atividade
    INSERT INTO user_activity_log (
        user_id, activity_type, activity_description
    )
    VALUES (
        p_user_id, 'sessions_invalidated', 
        'Todas as sessões do usuário foram invalidadas (' || v_count || ' sessões)'
    );
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNÇÕES DE ESTATÍSTICAS
-- =====================================================

-- Função para obter estatísticas de usuário
CREATE OR REPLACE FUNCTION get_user_statistics(p_user_id INTEGER)
RETURNS TABLE(
    total_favorites INTEGER,
    movies_count INTEGER,
    series_count INTEGER,
    channels_count INTEGER,
    categories_count INTEGER,
    total_watch_time INTEGER,
    avg_rating DECIMAL(3,1),
    most_watched_genre TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(f.id)::INTEGER as total_favorites,
        COUNT(CASE WHEN f.item_type = 'movie' THEN 1 END)::INTEGER as movies_count,
        COUNT(CASE WHEN f.item_type = 'series' THEN 1 END)::INTEGER as series_count,
        COUNT(CASE WHEN f.item_type = 'channel' THEN 1 END)::INTEGER as channels_count,
        (SELECT COUNT(*) FROM favorite_categories WHERE user_id = p_user_id)::INTEGER as categories_count,
        COALESCE(SUM(f.duration * f.watch_count), 0)::INTEGER as total_watch_time,
        ROUND(AVG(f.rating), 1) as avg_rating,
        (
            SELECT f2.genre 
            FROM favorites f2 
            WHERE f2.user_id = p_user_id AND f2.genre IS NOT NULL
            GROUP BY f2.genre 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        ) as most_watched_genre
    FROM favorites f
    WHERE f.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Função para obter estatísticas globais do sistema
CREATE OR REPLACE FUNCTION get_system_statistics()
RETURNS TABLE(
    total_users INTEGER,
    active_users INTEGER,
    total_favorites INTEGER,
    total_sessions INTEGER,
    active_sessions INTEGER,
    popular_genre TEXT,
    avg_favorites_per_user DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL)::INTEGER as total_users,
        (SELECT COUNT(*) FROM users WHERE status = 'active' AND deleted_at IS NULL)::INTEGER as active_users,
        (SELECT COUNT(*) FROM favorites)::INTEGER as total_favorites,
        (SELECT COUNT(*) FROM user_sessions)::INTEGER as total_sessions,
        (SELECT COUNT(*) FROM user_sessions WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP)::INTEGER as active_sessions,
        (
            SELECT f.genre 
            FROM favorites f 
            WHERE f.genre IS NOT NULL
            GROUP BY f.genre 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        ) as popular_genre,
        (
            SELECT ROUND(COUNT(f.*)::DECIMAL / NULLIF(COUNT(DISTINCT f.user_id), 0), 2)
            FROM favorites f
            JOIN users u ON f.user_id = u.id
            WHERE u.deleted_at IS NULL
        ) as avg_favorites_per_user;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNÇÕES DE MANUTENÇÃO
-- =====================================================

-- Função para limpeza geral do banco
CREATE OR REPLACE FUNCTION maintenance_cleanup()
RETURNS TABLE(
    task TEXT,
    records_affected INTEGER,
    success BOOLEAN
) AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Limpar sessões expiradas
    SELECT cleanup_expired_sessions() INTO v_count;
    RETURN QUERY SELECT 'Sessões expiradas removidas'::TEXT, v_count, TRUE;
    
    -- Limpar logs antigos (mais de 1 ano)
    DELETE FROM user_activity_log 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 year';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT 'Logs antigos removidos'::TEXT, v_count, TRUE;
    
    -- Atualizar estatísticas das tabelas
    ANALYZE users;
    ANALYZE favorites;
    ANALYZE user_sessions;
    RETURN QUERY SELECT 'Estatísticas atualizadas'::TEXT, 0, TRUE;
    
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMENTÁRIOS DAS FUNÇÕES
-- =====================================================

COMMENT ON FUNCTION generate_slug(TEXT) IS 'Gera slug URL-friendly a partir de texto';
COMMENT ON FUNCTION is_valid_email(TEXT) IS 'Valida formato de email';
COMMENT ON FUNCTION is_strong_password(TEXT) IS 'Valida se senha atende critérios de segurança';
COMMENT ON FUNCTION create_user IS 'Cria usuário completo com validações e categorias padrão';
COMMENT ON FUNCTION add_favorite IS 'Adiciona item aos favoritos com validações';
COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Remove sessões expiradas do sistema';
COMMENT ON FUNCTION get_user_statistics(INTEGER) IS 'Retorna estatísticas detalhadas de um usuário';
COMMENT ON FUNCTION maintenance_cleanup() IS 'Executa limpeza geral do banco de dados';

