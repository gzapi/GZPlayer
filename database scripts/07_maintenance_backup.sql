-- =====================================================
-- WebPlayer Database - Manutenção e Backup
-- Versão: 1.0
-- Data: 01/07/2025
-- Descrição: Scripts de manutenção, backup e monitoramento
-- =====================================================

-- Conectar ao banco webplayer_db
-- \c webplayer_db;

-- =====================================================
-- FUNÇÕES DE MANUTENÇÃO AUTOMÁTICA
-- =====================================================

-- Função para limpeza automática de dados antigos
CREATE OR REPLACE FUNCTION automated_cleanup()
RETURNS TABLE(
    task TEXT,
    records_affected INTEGER,
    execution_time INTERVAL,
    status TEXT
) AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    v_count INTEGER;
BEGIN
    start_time := CURRENT_TIMESTAMP;
    
    -- 1. Limpar sessões expiradas há mais de 7 dias
    DELETE FROM user_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    end_time := CURRENT_TIMESTAMP;
    RETURN QUERY SELECT 
        'Sessões expiradas removidas'::TEXT, 
        v_count, 
        end_time - start_time, 
        'SUCCESS'::TEXT;
    
    -- 2. Limpar logs de atividade antigos (mais de 6 meses)
    start_time := CURRENT_TIMESTAMP;
    DELETE FROM user_activity_log 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '6 months';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    end_time := CURRENT_TIMESTAMP;
    RETURN QUERY SELECT 
        'Logs antigos removidos'::TEXT, 
        v_count, 
        end_time - start_time, 
        'SUCCESS'::TEXT;
    
    -- 3. Limpar tokens de reset de senha expirados
    start_time := CURRENT_TIMESTAMP;
    UPDATE users 
    SET password_reset_token = NULL, 
        password_reset_expires = NULL
    WHERE password_reset_expires < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    end_time := CURRENT_TIMESTAMP;
    RETURN QUERY SELECT 
        'Tokens de reset expirados limpos'::TEXT, 
        v_count, 
        end_time - start_time, 
        'SUCCESS'::TEXT;
    
    -- 4. Desbloquear contas com lockout expirado
    start_time := CURRENT_TIMESTAMP;
    UPDATE users 
    SET locked_until = NULL, 
        login_attempts = 0
    WHERE locked_until < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    end_time := CURRENT_TIMESTAMP;
    RETURN QUERY SELECT 
        'Contas desbloqueadas'::TEXT, 
        v_count, 
        end_time - start_time, 
        'SUCCESS'::TEXT;
    
    -- 5. Atualizar estatísticas das tabelas
    start_time := CURRENT_TIMESTAMP;
    ANALYZE users;
    ANALYZE favorites;
    ANALYZE user_sessions;
    ANALYZE user_activity_log;
    end_time := CURRENT_TIMESTAMP;
    RETURN QUERY SELECT 
        'Estatísticas atualizadas'::TEXT, 
        0, 
        end_time - start_time, 
        'SUCCESS'::TEXT;
    
    -- 6. Reindexar tabelas se necessário
    start_time := CURRENT_TIMESTAMP;
    REINDEX TABLE favorites;
    REINDEX TABLE user_activity_log;
    end_time := CURRENT_TIMESTAMP;
    RETURN QUERY SELECT 
        'Índices refeitos'::TEXT, 
        0, 
        end_time - start_time, 
        'SUCCESS'::TEXT;
    
END;
$$ LANGUAGE plpgsql;

-- Função para verificar integridade do banco
CREATE OR REPLACE FUNCTION check_database_integrity()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT,
    recommendation TEXT
) AS $$
BEGIN
    -- Verificar usuários órfãos (sem favoritos há muito tempo)
    RETURN QUERY
    SELECT 
        'Usuários inativos'::TEXT,
        CASE 
            WHEN COUNT(*) > 0 THEN 'WARNING'::TEXT
            ELSE 'OK'::TEXT
        END,
        'Usuários sem atividade há mais de 1 ano: ' || COUNT(*)::TEXT,
        CASE 
            WHEN COUNT(*) > 0 THEN 'Considerar arquivamento ou notificação'::TEXT
            ELSE 'Nenhuma ação necessária'::TEXT
        END
    FROM users u
    WHERE u.deleted_at IS NULL
        AND u.last_login < CURRENT_TIMESTAMP - INTERVAL '1 year'
        AND NOT EXISTS (
            SELECT 1 FROM favorites f WHERE f.user_id = u.id 
            AND f.created_at > CURRENT_TIMESTAMP - INTERVAL '1 year'
        );
    
    -- Verificar favoritos sem categoria
    RETURN QUERY
    SELECT 
        'Favoritos sem categoria'::TEXT,
        CASE 
            WHEN COUNT(*) > 0 THEN 'INFO'::TEXT
            ELSE 'OK'::TEXT
        END,
        'Favoritos não categorizados: ' || COUNT(*)::TEXT,
        CASE 
            WHEN COUNT(*) > 0 THEN 'Sugerir categorização automática'::TEXT
            ELSE 'Todos os favoritos estão categorizados'::TEXT
        END
    FROM favorites f
    WHERE NOT EXISTS (
        SELECT 1 FROM favorite_category_items fci 
        WHERE fci.favorite_id = f.id
    );
    
    -- Verificar sessões ativas há muito tempo
    RETURN QUERY
    SELECT 
        'Sessões longas'::TEXT,
        CASE 
            WHEN COUNT(*) > 0 THEN 'WARNING'::TEXT
            ELSE 'OK'::TEXT
        END,
        'Sessões ativas há mais de 30 dias: ' || COUNT(*)::TEXT,
        CASE 
            WHEN COUNT(*) > 0 THEN 'Verificar possível comprometimento'::TEXT
            ELSE 'Duração das sessões normal'::TEXT
        END
    FROM user_sessions us
    WHERE us.is_active = TRUE
        AND us.created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    -- Verificar tamanho das tabelas
    RETURN QUERY
    SELECT 
        'Tamanho das tabelas'::TEXT,
        'INFO'::TEXT,
        'Tabela user_activity_log: ' || 
        pg_size_pretty(pg_total_relation_size('user_activity_log')) ||
        ', Total DB: ' || 
        pg_size_pretty(pg_database_size(current_database())),
        'Monitorar crescimento para planejamento de capacidade'::TEXT;
    
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNÇÕES DE BACKUP E RESTORE
-- =====================================================

-- Função para preparar backup dos dados essenciais
CREATE OR REPLACE FUNCTION prepare_backup_data()
RETURNS TABLE(
    table_name TEXT,
    record_count BIGINT,
    size_estimate TEXT,
    backup_priority INTEGER
) AS $$
BEGIN
    -- Prioridade 1: Dados críticos
    RETURN QUERY
    SELECT 
        'users'::TEXT,
        COUNT(*),
        pg_size_pretty(pg_total_relation_size('users')),
        1
    FROM users WHERE deleted_at IS NULL;
    
    RETURN QUERY
    SELECT 
        'favorites'::TEXT,
        COUNT(*),
        pg_size_pretty(pg_total_relation_size('favorites')),
        1
    FROM favorites;
    
    RETURN QUERY
    SELECT 
        'favorite_categories'::TEXT,
        COUNT(*),
        pg_size_pretty(pg_total_relation_size('favorite_categories')),
        1
    FROM favorite_categories;
    
    -- Prioridade 2: Dados importantes
    RETURN QUERY
    SELECT 
        'system_settings'::TEXT,
        COUNT(*),
        pg_size_pretty(pg_total_relation_size('system_settings')),
        2
    FROM system_settings;
    
    RETURN QUERY
    SELECT 
        'favorite_category_items'::TEXT,
        COUNT(*),
        pg_size_pretty(pg_total_relation_size('favorite_category_items')),
        2
    FROM favorite_category_items;
    
    -- Prioridade 3: Dados de auditoria (opcional)
    RETURN QUERY
    SELECT 
        'user_activity_log'::TEXT,
        COUNT(*),
        pg_size_pretty(pg_total_relation_size('user_activity_log')),
        3
    FROM user_activity_log;
    
    RETURN QUERY
    SELECT 
        'user_sessions'::TEXT,
        COUNT(*),
        pg_size_pretty(pg_total_relation_size('user_sessions')),
        3
    FROM user_sessions WHERE is_active = TRUE;
    
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEWS DE MONITORAMENTO
-- =====================================================

-- View para monitorar performance das consultas
CREATE VIEW performance_monitor AS
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    n_distinct,
    correlation,
    most_common_vals,
    most_common_freqs
FROM pg_stats 
WHERE schemaname = 'public'
    AND tablename IN ('users', 'favorites', 'user_sessions', 'user_activity_log')
ORDER BY tablename, attname;

-- View para monitorar uso de espaço
CREATE VIEW storage_monitor AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size,
    (SELECT COUNT(*) FROM information_schema.tables t WHERE t.table_schema = schemaname AND t.table_name = tablename) as table_count
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- View para monitorar atividade do banco
CREATE VIEW activity_monitor AS
SELECT 
    datname as database_name,
    numbackends as active_connections,
    xact_commit as transactions_committed,
    xact_rollback as transactions_rolled_back,
    blks_read as blocks_read,
    blks_hit as blocks_hit,
    ROUND((blks_hit::FLOAT / NULLIF(blks_hit + blks_read, 0)) * 100, 2) as cache_hit_ratio,
    tup_returned as tuples_returned,
    tup_fetched as tuples_fetched,
    tup_inserted as tuples_inserted,
    tup_updated as tuples_updated,
    tup_deleted as tuples_deleted,
    stats_reset
FROM pg_stat_database 
WHERE datname = current_database();

-- =====================================================
-- JOBS DE MANUTENÇÃO AUTOMÁTICA
-- =====================================================

-- Função para agendar manutenção (usar com pg_cron se disponível)
CREATE OR REPLACE FUNCTION schedule_maintenance_tasks()
RETURNS TEXT AS $$
BEGIN
    -- Esta função seria usada com pg_cron para agendar tarefas
    -- Exemplo: SELECT cron.schedule('cleanup-job', '0 2 * * *', 'SELECT automated_cleanup();');
    
    RETURN 'Para agendar manutenção automática, use pg_cron:
    
    -- Limpeza diária às 2h da manhã
    SELECT cron.schedule(''daily-cleanup'', ''0 2 * * *'', ''SELECT automated_cleanup();'');
    
    -- Verificação de integridade semanal aos domingos às 3h
    SELECT cron.schedule(''weekly-integrity'', ''0 3 * * 0'', ''SELECT check_database_integrity();'');
    
    -- Backup de estatísticas diário às 1h
    SELECT cron.schedule(''daily-stats'', ''0 1 * * *'', ''SELECT prepare_backup_data();'');';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SCRIPTS DE BACKUP MANUAL
-- =====================================================

-- Função para gerar script de backup completo
CREATE OR REPLACE FUNCTION generate_backup_script()
RETURNS TEXT AS $$
BEGIN
    RETURN '#!/bin/bash
# Script de backup automático do WebPlayer
# Gerado em: ' || CURRENT_TIMESTAMP || '

BACKUP_DIR="/backup/webplayer"
DB_NAME="webplayer_db"
DB_USER="webplayer_backup"
DATE=$(date +%Y%m%d_%H%M%S)

# Criar diretório de backup
mkdir -p $BACKUP_DIR

# Backup completo do banco
pg_dump -h localhost -U $DB_USER -d $DB_NAME -f $BACKUP_DIR/webplayer_full_$DATE.sql

# Backup apenas dos dados essenciais (sem logs)
pg_dump -h localhost -U $DB_USER -d $DB_NAME \
    --exclude-table=user_activity_log \
    --exclude-table=user_sessions \
    -f $BACKUP_DIR/webplayer_essential_$DATE.sql

# Backup apenas da estrutura
pg_dump -h localhost -U $DB_USER -d $DB_NAME --schema-only \
    -f $BACKUP_DIR/webplayer_schema_$DATE.sql

# Compactar backups
gzip $BACKUP_DIR/webplayer_*.sql

# Remover backups antigos (mais de 30 dias)
find $BACKUP_DIR -name "webplayer_*.sql.gz" -mtime +30 -delete

echo "Backup concluído: $DATE"';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ALERTAS E NOTIFICAÇÕES
-- =====================================================

-- Função para verificar alertas do sistema
CREATE OR REPLACE FUNCTION check_system_alerts()
RETURNS TABLE(
    alert_level TEXT,
    alert_type TEXT,
    message TEXT,
    action_required TEXT
) AS $$
BEGIN
    -- Alerta: Muitos usuários bloqueados
    RETURN QUERY
    SELECT 
        'WARNING'::TEXT,
        'SECURITY'::TEXT,
        'Usuários bloqueados: ' || COUNT(*)::TEXT,
        'Verificar possível ataque de força bruta'::TEXT
    FROM users 
    WHERE locked_until > CURRENT_TIMESTAMP
    HAVING COUNT(*) > 10;
    
    -- Alerta: Crescimento rápido de logs
    RETURN QUERY
    SELECT 
        'INFO'::TEXT,
        'STORAGE'::TEXT,
        'Logs criados nas últimas 24h: ' || COUNT(*)::TEXT,
        'Monitorar crescimento do banco'::TEXT
    FROM user_activity_log 
    WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
    HAVING COUNT(*) > 10000;
    
    -- Alerta: Sessões suspeitas
    RETURN QUERY
    SELECT 
        'WARNING'::TEXT,
        'SECURITY'::TEXT,
        'Sessões de IPs diferentes para mesmo usuário: ' || COUNT(DISTINCT us.ip_address)::TEXT,
        'Verificar possível comprometimento de conta'::TEXT
    FROM user_sessions us
    WHERE us.is_active = TRUE
        AND us.created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
    GROUP BY us.user_id
    HAVING COUNT(DISTINCT us.ip_address) > 3;
    
    -- Alerta: Espaço em disco
    RETURN QUERY
    SELECT 
        CASE 
            WHEN pg_database_size(current_database()) > 1073741824 THEN 'WARNING'::TEXT  -- 1GB
            ELSE 'INFO'::TEXT
        END,
        'STORAGE'::TEXT,
        'Tamanho do banco: ' || pg_size_pretty(pg_database_size(current_database())),
        CASE 
            WHEN pg_database_size(current_database()) > 1073741824 THEN 'Considerar limpeza ou expansão'::TEXT
            ELSE 'Tamanho normal'::TEXT
        END;
    
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RELATÓRIOS DE MANUTENÇÃO
-- =====================================================

-- Função para gerar relatório completo de manutenção
CREATE OR REPLACE FUNCTION generate_maintenance_report()
RETURNS TABLE(
    section TEXT,
    metric TEXT,
    value TEXT,
    status TEXT
) AS $$
BEGIN
    -- Seção: Estatísticas Gerais
    RETURN QUERY
    SELECT 
        'GENERAL'::TEXT,
        'Total de usuários ativos'::TEXT,
        COUNT(*)::TEXT,
        'OK'::TEXT
    FROM users WHERE status = 'active' AND deleted_at IS NULL;
    
    RETURN QUERY
    SELECT 
        'GENERAL'::TEXT,
        'Total de favoritos'::TEXT,
        COUNT(*)::TEXT,
        'OK'::TEXT
    FROM favorites;
    
    RETURN QUERY
    SELECT 
        'GENERAL'::TEXT,
        'Sessões ativas'::TEXT,
        COUNT(*)::TEXT,
        'OK'::TEXT
    FROM user_sessions 
    WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP;
    
    -- Seção: Performance
    RETURN QUERY
    SELECT 
        'PERFORMANCE'::TEXT,
        'Cache hit ratio'::TEXT,
        ROUND((blks_hit::FLOAT / NULLIF(blks_hit + blks_read, 0)) * 100, 2)::TEXT || '%',
        CASE 
            WHEN ROUND((blks_hit::FLOAT / NULLIF(blks_hit + blks_read, 0)) * 100, 2) > 95 THEN 'GOOD'::TEXT
            WHEN ROUND((blks_hit::FLOAT / NULLIF(blks_hit + blks_read, 0)) * 100, 2) > 90 THEN 'OK'::TEXT
            ELSE 'WARNING'::TEXT
        END
    FROM pg_stat_database WHERE datname = current_database();
    
    -- Seção: Armazenamento
    RETURN QUERY
    SELECT 
        'STORAGE'::TEXT,
        'Tamanho total do banco'::TEXT,
        pg_size_pretty(pg_database_size(current_database())),
        'INFO'::TEXT;
    
    RETURN QUERY
    SELECT 
        'STORAGE'::TEXT,
        'Maior tabela'::TEXT,
        (SELECT tablename || ' (' || pg_size_pretty(pg_total_relation_size('public.' || tablename)) || ')'
         FROM pg_tables 
         WHERE schemaname = 'public'
         ORDER BY pg_total_relation_size('public.' || tablename) DESC 
         LIMIT 1),
        'INFO'::TEXT;
    
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PERMISSÕES PARA FUNÇÕES DE MANUTENÇÃO
-- =====================================================

-- Permitir que role de backup execute funções de manutenção
GRANT EXECUTE ON FUNCTION automated_cleanup() TO webplayer_admin_role;
GRANT EXECUTE ON FUNCTION check_database_integrity() TO webplayer_admin_role;
GRANT EXECUTE ON FUNCTION prepare_backup_data() TO webplayer_backup_role;
GRANT EXECUTE ON FUNCTION check_system_alerts() TO webplayer_admin_role;
GRANT EXECUTE ON FUNCTION generate_maintenance_report() TO webplayer_admin_role;

-- Permitir acesso às views de monitoramento
GRANT SELECT ON performance_monitor TO webplayer_admin_role;
GRANT SELECT ON storage_monitor TO webplayer_admin_role;
GRANT SELECT ON activity_monitor TO webplayer_admin_role;

-- =====================================================
-- COMENTÁRIOS DAS FUNÇÕES DE MANUTENÇÃO
-- =====================================================

COMMENT ON FUNCTION automated_cleanup() IS 'Executa limpeza automática de dados antigos e otimizações';
COMMENT ON FUNCTION check_database_integrity() IS 'Verifica integridade e consistência dos dados';
COMMENT ON FUNCTION prepare_backup_data() IS 'Prepara informações para backup dos dados essenciais';
COMMENT ON FUNCTION check_system_alerts() IS 'Verifica alertas de segurança e performance';
COMMENT ON FUNCTION generate_maintenance_report() IS 'Gera relatório completo de manutenção';
COMMENT ON VIEW performance_monitor IS 'Monitora performance das consultas e estatísticas';
COMMENT ON VIEW storage_monitor IS 'Monitora uso de espaço em disco';
COMMENT ON VIEW activity_monitor IS 'Monitora atividade geral do banco de dados';

-- =====================================================
-- TESTE DAS FUNÇÕES DE MANUTENÇÃO
-- =====================================================

-- Executar verificação inicial
SELECT 'Executando verificação inicial de integridade...' as status;
SELECT * FROM check_database_integrity();

SELECT 'Verificando alertas do sistema...' as status;
SELECT * FROM check_system_alerts();

SELECT 'Preparando informações de backup...' as status;
SELECT * FROM prepare_backup_data();

RAISE NOTICE 'Scripts de manutenção e backup configurados com sucesso!';

