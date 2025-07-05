-- =====================================================
-- WebPlayer Database - Segurança e Permissões
-- Versão: 1.0
-- Data: 01/07/2025
-- Descrição: Configurações de segurança e permissões
-- =====================================================

-- Conectar ao banco webplayer_db
-- \c webplayer_db;

-- =====================================================
-- CRIAÇÃO DE ROLES E USUÁRIOS
-- =====================================================

-- Role para aplicação (leitura e escrita)
CREATE ROLE webplayer_app_role;

-- Role para relatórios (apenas leitura)
CREATE ROLE webplayer_readonly_role;

-- Role para backup (leitura completa)
CREATE ROLE webplayer_backup_role;

-- Role para administração
CREATE ROLE webplayer_admin_role;

-- =====================================================
-- PERMISSÕES PARA ROLE DA APLICAÇÃO
-- =====================================================

-- Permissões de SELECT, INSERT, UPDATE, DELETE nas tabelas principais
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users TO webplayer_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_sessions TO webplayer_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE favorites TO webplayer_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE favorite_categories TO webplayer_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE favorite_category_items TO webplayer_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_activity_log TO webplayer_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_settings TO webplayer_app_role;

-- Permissões nas sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO webplayer_app_role;

-- Permissões nas views
GRANT SELECT ON user_stats TO webplayer_app_role;
GRANT SELECT ON favorites_with_categories TO webplayer_app_role;

-- Permissões para executar funções
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO webplayer_app_role;

-- =====================================================
-- PERMISSÕES PARA ROLE READONLY
-- =====================================================

-- Apenas SELECT nas tabelas
GRANT SELECT ON ALL TABLES IN SCHEMA public TO webplayer_readonly_role;

-- Permissões nas views
GRANT SELECT ON user_stats TO webplayer_readonly_role;
GRANT SELECT ON favorites_with_categories TO webplayer_readonly_role;

-- Permissões para executar funções de consulta
GRANT EXECUTE ON FUNCTION get_user_statistics(INTEGER) TO webplayer_readonly_role;
GRANT EXECUTE ON FUNCTION get_system_statistics() TO webplayer_readonly_role;

-- =====================================================
-- PERMISSÕES PARA ROLE BACKUP
-- =====================================================

-- Leitura completa para backup
GRANT SELECT ON ALL TABLES IN SCHEMA public TO webplayer_backup_role;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO webplayer_backup_role;

-- =====================================================
-- PERMISSÕES PARA ROLE ADMIN
-- =====================================================

-- Todas as permissões para administração
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO webplayer_admin_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO webplayer_admin_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO webplayer_admin_role;

-- =====================================================
-- CRIAÇÃO DE USUÁRIOS ESPECÍFICOS
-- =====================================================

-- Usuário da aplicação
-- CREATE USER webplayer_app WITH PASSWORD 'app_secure_password_2025';
-- GRANT webplayer_app_role TO webplayer_app;

-- Usuário para relatórios
-- CREATE USER webplayer_reports WITH PASSWORD 'reports_secure_password_2025';
-- GRANT webplayer_readonly_role TO webplayer_reports;

-- Usuário para backup
-- CREATE USER webplayer_backup WITH PASSWORD 'backup_secure_password_2025';
-- GRANT webplayer_backup_role TO webplayer_backup;

-- Usuário administrador
-- CREATE USER webplayer_admin WITH PASSWORD 'admin_secure_password_2025';
-- GRANT webplayer_admin_role TO webplayer_admin;

-- =====================================================
-- POLÍTICAS DE SEGURANÇA (RLS - Row Level Security)
-- =====================================================

-- Habilitar RLS nas tabelas sensíveis
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

-- Política para usuários: cada usuário só vê seus próprios dados
CREATE POLICY user_isolation_policy ON users
    FOR ALL
    TO webplayer_app_role
    USING (id = current_setting('app.current_user_id')::INTEGER);

-- Política para favoritos: cada usuário só vê seus próprios favoritos
CREATE POLICY favorites_isolation_policy ON favorites
    FOR ALL
    TO webplayer_app_role
    USING (user_id = current_setting('app.current_user_id')::INTEGER);

-- Política para categorias: cada usuário só vê suas próprias categorias
CREATE POLICY categories_isolation_policy ON favorite_categories
    FOR ALL
    TO webplayer_app_role
    USING (user_id = current_setting('app.current_user_id')::INTEGER);

-- Política para sessões: cada usuário só vê suas próprias sessões
CREATE POLICY sessions_isolation_policy ON user_sessions
    FOR ALL
    TO webplayer_app_role
    USING (user_id = current_setting('app.current_user_id')::INTEGER);

-- Política para logs: cada usuário só vê seus próprios logs
CREATE POLICY activity_log_isolation_policy ON user_activity_log
    FOR ALL
    TO webplayer_app_role
    USING (user_id = current_setting('app.current_user_id')::INTEGER);

-- Política para administradores: acesso total
CREATE POLICY admin_full_access_policy ON users
    FOR ALL
    TO webplayer_admin_role
    USING (true);

CREATE POLICY admin_favorites_policy ON favorites
    FOR ALL
    TO webplayer_admin_role
    USING (true);

CREATE POLICY admin_categories_policy ON favorite_categories
    FOR ALL
    TO webplayer_admin_role
    USING (true);

CREATE POLICY admin_sessions_policy ON user_sessions
    FOR ALL
    TO webplayer_admin_role
    USING (true);

CREATE POLICY admin_activity_log_policy ON user_activity_log
    FOR ALL
    TO webplayer_admin_role
    USING (true);

-- =====================================================
-- FUNÇÕES DE SEGURANÇA
-- =====================================================

-- Função para definir usuário atual na sessão
CREATE OR REPLACE FUNCTION set_current_user_id(user_id INTEGER)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_id::TEXT, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter usuário atual da sessão
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS INTEGER AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true)::INTEGER;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Função para verificar se usuário é admin
CREATE OR REPLACE FUNCTION is_admin_user(user_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    user_prefs JSONB;
BEGIN
    SELECT preferences INTO user_prefs 
    FROM users 
    WHERE id = user_id AND deleted_at IS NULL;
    
    RETURN (user_prefs->>'role' = 'admin');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS DE SEGURANÇA
-- =====================================================

-- Trigger para log automático de alterações sensíveis
CREATE OR REPLACE FUNCTION security_audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Log para alterações em usuários
    IF TG_TABLE_NAME = 'users' THEN
        IF TG_OP = 'UPDATE' THEN
            INSERT INTO user_activity_log (
                user_id, activity_type, activity_description, 
                entity_type, entity_id, extra_data
            ) VALUES (
                NEW.id, 'user_updated', 'Dados do usuário foram alterados',
                'user', NEW.id, 
                json_build_object('changed_fields', 
                    CASE 
                        WHEN OLD.email != NEW.email THEN json_build_object('email', json_build_array(OLD.email, NEW.email))
                        WHEN OLD.status != NEW.status THEN json_build_object('status', json_build_array(OLD.status, NEW.status))
                        ELSE '{}'::json
                    END
                )
            );
        ELSIF TG_OP = 'DELETE' THEN
            INSERT INTO user_activity_log (
                user_id, activity_type, activity_description,
                entity_type, entity_id
            ) VALUES (
                OLD.id, 'user_deleted', 'Usuário foi removido do sistema',
                'user', OLD.id
            );
        END IF;
    END IF;
    
    -- Log para alterações em favoritos
    IF TG_TABLE_NAME = 'favorites' THEN
        IF TG_OP = 'DELETE' THEN
            INSERT INTO user_activity_log (
                user_id, activity_type, activity_description,
                entity_type, entity_id
            ) VALUES (
                OLD.user_id, 'favorite_removed', 'Favorito removido: ' || OLD.title,
                'favorite', OLD.id
            );
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers de auditoria
CREATE TRIGGER users_security_audit_trigger
    AFTER UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION security_audit_trigger();

CREATE TRIGGER favorites_security_audit_trigger
    AFTER DELETE ON favorites
    FOR EACH ROW EXECUTE FUNCTION security_audit_trigger();

-- =====================================================
-- CONFIGURAÇÕES DE SEGURANÇA DO POSTGRESQL
-- =====================================================

-- Configurar timeout de conexão inativa
-- ALTER SYSTEM SET idle_in_transaction_session_timeout = '10min';

-- Configurar log de conexões
-- ALTER SYSTEM SET log_connections = on;
-- ALTER SYSTEM SET log_disconnections = on;

-- Configurar log de comandos DDL
-- ALTER SYSTEM SET log_statement = 'ddl';

-- Configurar log de comandos lentos
-- ALTER SYSTEM SET log_min_duration_statement = 1000; -- 1 segundo

-- =====================================================
-- VIEWS DE SEGURANÇA E AUDITORIA
-- =====================================================

-- View para monitorar tentativas de login
CREATE VIEW login_attempts_monitor AS
SELECT 
    u.username,
    u.email,
    u.login_attempts,
    u.locked_until,
    u.last_login,
    COUNT(ual.id) as recent_login_attempts
FROM users u
LEFT JOIN user_activity_log ual ON u.id = ual.user_id 
    AND ual.activity_type = 'login_failed'
    AND ual.created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.username, u.email, u.login_attempts, u.locked_until, u.last_login;

-- View para monitorar sessões ativas
CREATE VIEW active_sessions_monitor AS
SELECT 
    u.username,
    u.email,
    us.session_type,
    us.ip_address,
    us.user_agent,
    us.created_at,
    us.last_activity,
    us.expires_at
FROM user_sessions us
JOIN users u ON us.user_id = u.id
WHERE us.is_active = TRUE 
    AND us.expires_at > CURRENT_TIMESTAMP
    AND u.deleted_at IS NULL
ORDER BY us.last_activity DESC;

-- View para auditoria de atividades suspeitas
CREATE VIEW suspicious_activities AS
SELECT 
    u.username,
    ual.activity_type,
    ual.activity_description,
    ual.ip_address,
    ual.created_at,
    COUNT(*) OVER (
        PARTITION BY ual.user_id, ual.activity_type 
        ORDER BY ual.created_at 
        RANGE BETWEEN INTERVAL '1 hour' PRECEDING AND CURRENT ROW
    ) as frequency_last_hour
FROM user_activity_log ual
JOIN users u ON ual.user_id = u.id
WHERE ual.created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
    AND u.deleted_at IS NULL
ORDER BY ual.created_at DESC;

-- =====================================================
-- PERMISSÕES NAS VIEWS DE SEGURANÇA
-- =====================================================

-- Apenas admins podem ver views de segurança
GRANT SELECT ON login_attempts_monitor TO webplayer_admin_role;
GRANT SELECT ON active_sessions_monitor TO webplayer_admin_role;
GRANT SELECT ON suspicious_activities TO webplayer_admin_role;

-- =====================================================
-- COMENTÁRIOS DE SEGURANÇA
-- =====================================================

COMMENT ON POLICY user_isolation_policy ON users IS 'Política RLS: usuários só acessam seus próprios dados';
COMMENT ON POLICY favorites_isolation_policy ON favorites IS 'Política RLS: usuários só acessam seus próprios favoritos';
COMMENT ON FUNCTION set_current_user_id(INTEGER) IS 'Define o ID do usuário atual para políticas RLS';
COMMENT ON FUNCTION is_admin_user(INTEGER) IS 'Verifica se usuário tem privilégios de administrador';
COMMENT ON VIEW login_attempts_monitor IS 'Monitora tentativas de login para detectar ataques';
COMMENT ON VIEW active_sessions_monitor IS 'Monitora sessões ativas para auditoria';
COMMENT ON VIEW suspicious_activities IS 'Detecta atividades suspeitas baseadas em frequência';

-- =====================================================
-- VERIFICAÇÕES FINAIS DE SEGURANÇA
-- =====================================================

-- Verificar se RLS está habilitado
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
    AND rowsecurity = true;

-- Verificar políticas criadas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public';

-- Verificar roles criados
SELECT rolname, rolcanlogin, rolcreaterole, rolcreatedb 
FROM pg_roles 
WHERE rolname LIKE 'webplayer_%';

RAISE NOTICE 'Configurações de segurança aplicadas com sucesso!';

