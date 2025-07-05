-- =====================================================
-- WebPlayer Database - Dados Iniciais
-- Versão: 1.0
-- Data: 01/07/2025
-- Descrição: Inserção de dados iniciais e de exemplo
-- =====================================================

-- Conectar ao banco webplayer_db
-- \c webplayer_db;

-- =====================================================
-- CONFIGURAÇÕES DO SISTEMA
-- =====================================================

INSERT INTO system_settings (key, value, value_type, description, is_public) VALUES
('app_name', 'WebPlayer', 'string', 'Nome da aplicação', true),
('app_version', '1.0.0', 'string', 'Versão atual da aplicação', true),
('app_description', 'Sistema de streaming com autenticação e favoritos', 'string', 'Descrição da aplicação', true),
('max_favorites_per_user', '1000', 'integer', 'Máximo de favoritos por usuário', false),
('max_categories_per_user', '20', 'integer', 'Máximo de categorias por usuário', false),
('session_timeout_hours', '24', 'integer', 'Timeout de sessão em horas', false),
('refresh_token_days', '30', 'integer', 'Validade do refresh token em dias', false),
('password_min_length', '8', 'integer', 'Tamanho mínimo da senha', true),
('allow_registration', 'true', 'boolean', 'Permitir registro de novos usuários', true),
('require_email_verification', 'false', 'boolean', 'Exigir verificação de email', false),
('max_login_attempts', '5', 'integer', 'Máximo de tentativas de login', false),
('lockout_duration_minutes', '30', 'integer', 'Duração do bloqueio em minutos', false),
('enable_activity_log', 'true', 'boolean', 'Habilitar log de atividades', false),
('default_language', 'pt-BR', 'string', 'Idioma padrão do sistema', true),
('default_timezone', 'America/Sao_Paulo', 'string', 'Timezone padrão do sistema', true),
('api_rate_limit_per_minute', '100', 'integer', 'Limite de requisições por minuto', false),
('enable_cors', 'true', 'boolean', 'Habilitar CORS', false),
('cors_origins', '*', 'string', 'Origens permitidas para CORS', false),
('enable_swagger', 'true', 'boolean', 'Habilitar documentação Swagger', true),
('maintenance_mode', 'false', 'boolean', 'Modo de manutenção', true);

-- =====================================================
-- USUÁRIO ADMINISTRADOR PADRÃO
-- =====================================================

-- Inserir usuário admin (senha: admin123)
-- Hash bcrypt para 'admin123': $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXwtO5KjVlxK
INSERT INTO users (
    username, 
    email, 
    password_hash, 
    first_name, 
    last_name, 
    status,
    email_verified,
    preferences
) VALUES (
    'admin',
    'admin@webplayer.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXwtO5KjVlxK',
    'Administrador',
    'Sistema',
    'active',
    true,
    '{"role": "admin", "theme": "dark", "language": "pt-BR", "notifications": true}'
);

-- Obter ID do usuário admin para criar categorias
DO $$
DECLARE
    admin_user_id INTEGER;
BEGIN
    SELECT id INTO admin_user_id FROM users WHERE username = 'admin';
    
    -- Criar categorias padrão para o admin
    INSERT INTO favorite_categories (user_id, name, description, color, icon, sort_order, is_default) VALUES
        (admin_user_id, 'Filmes de Ação', 'Filmes de ação e aventura', '#F44336', 'local_movies', 1, true),
        (admin_user_id, 'Séries Drama', 'Séries dramáticas', '#9C27B0', 'tv', 2, true),
        (admin_user_id, 'Canais Notícias', 'Canais de notícias', '#2196F3', 'live_tv', 3, true),
        (admin_user_id, 'Documentários', 'Documentários educativos', '#4CAF50', 'school', 4, true),
        (admin_user_id, 'Infantil', 'Conteúdo infantil', '#FF9800', 'child_care', 5, true);
END $$;

-- =====================================================
-- USUÁRIOS DE EXEMPLO
-- =====================================================

-- Usuário de teste 1 (senha: teste123)
-- Hash bcrypt para 'teste123': $2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
INSERT INTO users (
    username, 
    email, 
    password_hash, 
    first_name, 
    last_name, 
    status,
    email_verified,
    preferences
) VALUES (
    'joao_silva',
    'joao.silva@email.com',
    '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'João',
    'Silva',
    'active',
    true,
    '{"theme": "light", "language": "pt-BR", "notifications": true, "auto_play": false}'
);

-- Usuário de teste 2 (senha: maria456)
-- Hash bcrypt para 'maria456': $2b$12$WvvTPHKwdBJ7w0/KaEhvtO5h1ZxfaMHiXhtVSdyp05nbVYpC1nu4W
INSERT INTO users (
    username, 
    email, 
    password_hash, 
    first_name, 
    last_name, 
    status,
    email_verified,
    preferences
) VALUES (
    'maria_santos',
    'maria.santos@email.com',
    '$2b$12$WvvTPHKwdBJ7w0/KaEhvtO5h1ZxfaMHiXhtVSdyp05nbVYpC1nu4W',
    'Maria',
    'Santos',
    'active',
    true,
    '{"theme": "dark", "language": "pt-BR", "notifications": false, "auto_play": true}'
);

-- Criar categorias para usuários de exemplo
DO $$
DECLARE
    joao_user_id INTEGER;
    maria_user_id INTEGER;
BEGIN
    SELECT id INTO joao_user_id FROM users WHERE username = 'joao_silva';
    SELECT id INTO maria_user_id FROM users WHERE username = 'maria_santos';
    
    -- Categorias para João
    INSERT INTO favorite_categories (user_id, name, description, color, icon, sort_order, is_default) VALUES
        (joao_user_id, 'Filmes', 'Meus filmes favoritos', '#E91E63', 'movie', 1, true),
        (joao_user_id, 'Séries', 'Minhas séries favoritas', '#9C27B0', 'tv', 2, true),
        (joao_user_id, 'Canais', 'Meus canais favoritos', '#2196F3', 'live_tv', 3, true),
        (joao_user_id, 'Comédia', 'Conteúdo de comédia', '#FFC107', 'sentiment_very_satisfied', 4, false);
    
    -- Categorias para Maria
    INSERT INTO favorite_categories (user_id, name, description, color, icon, sort_order, is_default) VALUES
        (maria_user_id, 'Filmes', 'Meus filmes favoritos', '#E91E63', 'movie', 1, true),
        (maria_user_id, 'Séries', 'Minhas séries favoritas', '#9C27B0', 'tv', 2, true),
        (maria_user_id, 'Canais', 'Meus canais favoritos', '#2196F3', 'live_tv', 3, true),
        (maria_user_id, 'Romance', 'Filmes e séries românticas', '#E91E63', 'favorite', 4, false),
        (maria_user_id, 'Suspense', 'Conteúdo de suspense', '#795548', 'visibility', 5, false);
END $$;

-- =====================================================
-- FAVORITOS DE EXEMPLO
-- =====================================================

-- Favoritos para João Silva
DO $$
DECLARE
    joao_user_id INTEGER;
    filmes_cat_id INTEGER;
    series_cat_id INTEGER;
    canais_cat_id INTEGER;
    fav_id INTEGER;
BEGIN
    SELECT id INTO joao_user_id FROM users WHERE username = 'joao_silva';
    SELECT id INTO filmes_cat_id FROM favorite_categories WHERE user_id = joao_user_id AND name = 'Filmes';
    SELECT id INTO series_cat_id FROM favorite_categories WHERE user_id = joao_user_id AND name = 'Séries';
    SELECT id INTO canais_cat_id FROM favorite_categories WHERE user_id = joao_user_id AND name = 'Canais';
    
    -- Filmes
    INSERT INTO favorites (
        user_id, item_id, item_type, title, description, image_url, url, genre, 
        duration, year, rating, extra_data
    ) VALUES 
    (
        joao_user_id, 'movie_vingadores_ultimato', 'movie', 
        'Vingadores: Ultimato', 
        'Os heróis mais poderosos da Terra enfrentam Thanos em uma batalha épica.',
        'https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9sl16pB3iy.jpg',
        'https://exemplo.com/vingadores-ultimato.mp4',
        'Ação', 181, 2019, 8.4,
        '{"director": "Anthony Russo, Joe Russo", "cast": ["Robert Downey Jr.", "Chris Evans", "Mark Ruffalo"], "imdb_id": "tt4154796"}'
    ),
    (
        joao_user_id, 'movie_parasita', 'movie',
        'Parasita',
        'Uma família pobre se infiltra na vida de uma família rica.',
        'https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
        'https://exemplo.com/parasita.mp4',
        'Drama', 132, 2019, 8.6,
        '{"director": "Bong Joon-ho", "country": "Coreia do Sul", "awards": ["Oscar Melhor Filme"]}'
    );
    
    -- Séries
    INSERT INTO favorites (
        user_id, item_id, item_type, title, description, image_url, url, genre,
        seasons, episodes, year, rating, extra_data
    ) VALUES
    (
        joao_user_id, 'series_breaking_bad', 'series',
        'Breaking Bad',
        'Um professor de química se torna fabricante de metanfetamina.',
        'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
        'https://exemplo.com/breaking-bad/',
        'Drama', 5, 62, 2008, 9.5,
        '{"creator": "Vince Gilligan", "network": "AMC", "status": "Finalizada"}'
    ),
    (
        joao_user_id, 'series_stranger_things', 'series',
        'Stranger Things',
        'Crianças enfrentam forças sobrenaturais em uma pequena cidade.',
        'https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg',
        'https://exemplo.com/stranger-things/',
        'Ficção Científica', 4, 34, 2016, 8.7,
        '{"creator": "Duffer Brothers", "network": "Netflix", "status": "Em andamento"}'
    );
    
    -- Canais
    INSERT INTO favorites (
        user_id, item_id, item_type, title, description, image_url, url, genre, extra_data
    ) VALUES
    (
        joao_user_id, 'channel_globo_hd', 'channel',
        'Globo HD',
        'Canal de televisão brasileiro com programação variada.',
        'https://exemplo.com/logos/globo.png',
        'https://exemplo.com/streams/globo.m3u8',
        'Entretenimento',
        '{"country": "Brasil", "language": "pt-BR", "hd": true}'
    ),
    (
        joao_user_id, 'channel_espn_brasil', 'channel',
        'ESPN Brasil',
        'Canal esportivo com cobertura completa do esporte nacional e internacional.',
        'https://exemplo.com/logos/espn.png',
        'https://exemplo.com/streams/espn.m3u8',
        'Esportes',
        '{"country": "Brasil", "language": "pt-BR", "sports": ["futebol", "basquete", "tênis"]}'
    );
    
    -- Associar favoritos às categorias
    -- Filmes
    SELECT id INTO fav_id FROM favorites WHERE user_id = joao_user_id AND item_id = 'movie_vingadores_ultimato';
    INSERT INTO favorite_category_items (favorite_id, category_id) VALUES (fav_id, filmes_cat_id);
    
    SELECT id INTO fav_id FROM favorites WHERE user_id = joao_user_id AND item_id = 'movie_parasita';
    INSERT INTO favorite_category_items (favorite_id, category_id) VALUES (fav_id, filmes_cat_id);
    
    -- Séries
    SELECT id INTO fav_id FROM favorites WHERE user_id = joao_user_id AND item_id = 'series_breaking_bad';
    INSERT INTO favorite_category_items (favorite_id, category_id) VALUES (fav_id, series_cat_id);
    
    SELECT id INTO fav_id FROM favorites WHERE user_id = joao_user_id AND item_id = 'series_stranger_things';
    INSERT INTO favorite_category_items (favorite_id, category_id) VALUES (fav_id, series_cat_id);
    
    -- Canais
    SELECT id INTO fav_id FROM favorites WHERE user_id = joao_user_id AND item_id = 'channel_globo_hd';
    INSERT INTO favorite_category_items (favorite_id, category_id) VALUES (fav_id, canais_cat_id);
    
    SELECT id INTO fav_id FROM favorites WHERE user_id = joao_user_id AND item_id = 'channel_espn_brasil';
    INSERT INTO favorite_category_items (favorite_id, category_id) VALUES (fav_id, canais_cat_id);
END $$;

-- Favoritos para Maria Santos
DO $$
DECLARE
    maria_user_id INTEGER;
    filmes_cat_id INTEGER;
    series_cat_id INTEGER;
    romance_cat_id INTEGER;
    fav_id INTEGER;
BEGIN
    SELECT id INTO maria_user_id FROM users WHERE username = 'maria_santos';
    SELECT id INTO filmes_cat_id FROM favorite_categories WHERE user_id = maria_user_id AND name = 'Filmes';
    SELECT id INTO series_cat_id FROM favorite_categories WHERE user_id = maria_user_id AND name = 'Séries';
    SELECT id INTO romance_cat_id FROM favorite_categories WHERE user_id = maria_user_id AND name = 'Romance';
    
    -- Filmes românticos
    INSERT INTO favorites (
        user_id, item_id, item_type, title, description, image_url, url, genre,
        duration, year, rating, extra_data
    ) VALUES
    (
        maria_user_id, 'movie_la_la_land', 'movie',
        'La La Land',
        'Uma história de amor entre um músico de jazz e uma atriz aspirante.',
        'https://image.tmdb.org/t/p/w500/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg',
        'https://exemplo.com/la-la-land.mp4',
        'Romance', 128, 2016, 8.0,
        '{"director": "Damien Chazelle", "awards": ["Oscar Melhor Direção", "Oscar Melhor Trilha Sonora"]}'
    ),
    (
        maria_user_id, 'movie_titanic', 'movie',
        'Titanic',
        'Uma história de amor épica a bordo do navio mais famoso da história.',
        'https://image.tmdb.org/t/p/w500/9xjZS2rlVxm8SFx8kPC3aIGCOYQ.jpg',
        'https://exemplo.com/titanic.mp4',
        'Romance', 194, 1997, 7.8,
        '{"director": "James Cameron", "box_office": "$2.2 billion", "awards": ["Oscar Melhor Filme"]}'
    );
    
    -- Séries
    INSERT INTO favorites (
        user_id, item_id, item_type, title, description, image_url, url, genre,
        seasons, episodes, year, rating, extra_data
    ) VALUES
    (
        maria_user_id, 'series_friends', 'series',
        'Friends',
        'Seis amigos vivem suas vidas em Nova York.',
        'https://image.tmdb.org/t/p/w500/f496cm9enuEsZkSPzCwnTESEK5s.jpg',
        'https://exemplo.com/friends/',
        'Comédia', 10, 236, 1994, 8.9,
        '{"creator": "David Crane, Marta Kauffman", "network": "NBC", "status": "Finalizada"}'
    ),
    (
        maria_user_id, 'series_bridgerton', 'series',
        'Bridgerton',
        'Romance e drama na alta sociedade londrina do século XIX.',
        'https://image.tmdb.org/t/p/w500/luoKpgVwi1E5nQsi7W0UuKHu2Rq.jpg',
        'https://exemplo.com/bridgerton/',
        'Romance', 2, 16, 2020, 7.3,
        '{"creator": "Chris Van Dusen", "network": "Netflix", "based_on": "Livros de Julia Quinn"}'
    );
    
    -- Associar favoritos às categorias
    SELECT id INTO fav_id FROM favorites WHERE user_id = maria_user_id AND item_id = 'movie_la_la_land';
    INSERT INTO favorite_category_items (favorite_id, category_id) VALUES (fav_id, filmes_cat_id), (fav_id, romance_cat_id);
    
    SELECT id INTO fav_id FROM favorites WHERE user_id = maria_user_id AND item_id = 'movie_titanic';
    INSERT INTO favorite_category_items (favorite_id, category_id) VALUES (fav_id, filmes_cat_id), (fav_id, romance_cat_id);
    
    SELECT id INTO fav_id FROM favorites WHERE user_id = maria_user_id AND item_id = 'series_friends';
    INSERT INTO favorite_category_items (favorite_id, category_id) VALUES (fav_id, series_cat_id);
    
    SELECT id INTO fav_id FROM favorites WHERE user_id = maria_user_id AND item_id = 'series_bridgerton';
    INSERT INTO favorite_category_items (favorite_id, category_id) VALUES (fav_id, series_cat_id), (fav_id, romance_cat_id);
END $$;

-- =====================================================
-- LOGS DE ATIVIDADE DE EXEMPLO
-- =====================================================

-- Logs para demonstrar o sistema de auditoria
INSERT INTO user_activity_log (user_id, activity_type, activity_description, entity_type, entity_id, ip_address) 
SELECT 
    u.id,
    'user_login',
    'Usuário fez login no sistema',
    'user',
    u.id,
    '192.168.1.100'::inet
FROM users u WHERE u.username IN ('joao_silva', 'maria_santos');

INSERT INTO user_activity_log (user_id, activity_type, activity_description, entity_type, entity_id, ip_address)
SELECT 
    f.user_id,
    'favorite_added',
    'Item adicionado aos favoritos: ' || f.title,
    'favorite',
    f.id,
    '192.168.1.100'::inet
FROM favorites f
LIMIT 5;

-- =====================================================
-- ATUALIZAR ESTATÍSTICAS
-- =====================================================

-- Atualizar estatísticas das tabelas
ANALYZE users;
ANALYZE user_sessions;
ANALYZE favorites;
ANALYZE favorite_categories;
ANALYZE favorite_category_items;
ANALYZE user_activity_log;
ANALYZE system_settings;

-- =====================================================
-- VERIFICAÇÕES FINAIS
-- =====================================================

-- Verificar se os dados foram inseridos corretamente
DO $$
DECLARE
    user_count INTEGER;
    favorite_count INTEGER;
    category_count INTEGER;
    setting_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users WHERE deleted_at IS NULL;
    SELECT COUNT(*) INTO favorite_count FROM favorites;
    SELECT COUNT(*) INTO category_count FROM favorite_categories;
    SELECT COUNT(*) INTO setting_count FROM system_settings;
    
    RAISE NOTICE 'Dados inseridos com sucesso:';
    RAISE NOTICE '- Usuários: %', user_count;
    RAISE NOTICE '- Favoritos: %', favorite_count;
    RAISE NOTICE '- Categorias: %', category_count;
    RAISE NOTICE '- Configurações: %', setting_count;
END $$;

