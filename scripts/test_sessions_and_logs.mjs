/**
 * SUÍTE DE TESTES: SESSÕES E LOGS DE AUDITORIA CONFIÁVEIS (SERVER-FIRST)
 * Validação rigorosa dos mecanismos de segurança introduzidos pelos scripts 05 e 06:
 * 
 * 1. Isolamento de Sessões: Visitante lê e grava apenas sua própria linha.
 * 2. Prevenção de Falsificação em Sessões: Trigger impede auto-promoção e desfaçatez de status.
 * 3. Heartbeat e "Online Agora": Dono da sessão atualiza last_seen; telemetria calcula < 3min.
 * 4. Isolamento de Logs de Auditoria: Apenas Gerente e Master realizam SELECT de logs.
 * 5. Prevenção de Falsificação de Logs: Servidor força actor_id = auth.uid() e deriva user_role do banco.
 * 6. Validação de Tamanho e Rate Limiting: Limites de caracteres e teto de 60 logs/min por usuário.
 * 7. Imutabilidade e Restrições de Exclusão: Ninguém edita logs; apenas Master pode excluir.
 * 8. Telemetria do Servidor (RPC get_telemetry_active_sessions): IPs mascarados para gerentes, abertos para Master.
 * 9. Rotina de Retenção e Expurgo (cleanup_stale_telemetry_and_anonymous): Exclusiva do Master.
 */

class ServerSecuritySimulator {
  constructor() {
    // Tabela auth.users (simulada)
    this.authUsers = new Map([
      ['master_uuid', { id: 'master_uuid', email: 'master@gov.pi.br', is_anonymous: false, created_at: new Date('2026-01-01T00:00:00Z'), last_sign_in_at: new Date() }],
      ['manager_uuid', { id: 'manager_uuid', email: 'gerente@gov.pi.br', is_anonymous: false, created_at: new Date('2026-01-05T00:00:00Z'), last_sign_in_at: new Date() }],
      ['user_uuid', { id: 'user_uuid', email: 'usuario@gov.pi.br', is_anonymous: false, created_at: new Date('2026-01-10T00:00:00Z'), last_sign_in_at: new Date() }],
      ['visitor_uuid_1', { id: 'visitor_uuid_1', email: null, is_anonymous: true, created_at: new Date(), last_sign_in_at: new Date() }],
      ['visitor_stale_uuid', { id: 'visitor_stale_uuid', email: null, is_anonymous: true, created_at: new Date(Date.now() - 40 * 86400000), last_sign_in_at: new Date(Date.now() - 35 * 86400000) }]
    ]);

    // Tabela public.profiles
    this.profiles = new Map([
      ['master_uuid', { id: 'master_uuid', username: 'master', name: 'Administrador Master', role: 'master', is_active: true }],
      ['manager_uuid', { id: 'manager_uuid', username: 'gerente_01', name: 'Gerente Operacional', role: 'manager', is_active: true }],
      ['user_uuid', { id: 'user_uuid', username: 'usuario_01', name: 'Usuário Padrão', role: 'user', is_active: true }]
    ]);

    // Tabela auth.sessions
    this.authSessions = new Map([
      ['s_master', { user_id: 'master_uuid', ip: '200.189.112.45', user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', created_at: new Date(), updated_at: new Date(), refreshed_at: new Date() }],
      ['s_manager', { user_id: 'manager_uuid', ip: '189.40.75.12', user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', created_at: new Date(), updated_at: new Date(), refreshed_at: new Date() }],
      ['s_visitor1', { user_id: 'visitor_uuid_1', ip: '177.136.200.88', user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', created_at: new Date(), updated_at: new Date(), refreshed_at: new Date() }],
      ['s_stale', { user_id: 'visitor_stale_uuid', ip: '179.100.50.25', user_agent: 'Mozilla/5.0 (Linux; Android 13)', created_at: new Date(Date.now() - 40 * 86400000), updated_at: new Date(Date.now() - 35 * 86400000), refreshed_at: new Date(Date.now() - 35 * 86400000) }]
    ]);

    // Tabela public.webgis_user_sessions
    this.userSessions = new Map();

    // Tabela public.webgis_logs
    this.logs = [];

    // Contexto de autenticação simulado
    this.currentContext = null;
  }

  setAuthContext(userId) {
    if (!userId) {
      this.currentContext = null;
      return;
    }
    const user = this.authUsers.get(userId);
    if (!user) throw new Error('Usuário inexistente no auth.users');
    const profile = this.profiles.get(userId);
    this.currentContext = {
      uid: userId,
      isAnonymous: user.is_anonymous,
      role: profile?.role || (user.is_anonymous ? 'visitor' : 'user'),
      isActive: profile ? profile.is_active : true
    };
  }

  isManager() {
    if (!this.currentContext) return false;
    return this.currentContext.role === 'manager' || this.currentContext.role === 'master';
  }

  isMaster() {
    if (!this.currentContext) return false;
    return this.currentContext.role === 'master';
  }

  // --- REGRAS DE SESSÕES (public.webgis_user_sessions) ---

  insertSession(payload) {
    if (!this.currentContext || !this.currentContext.uid) {
      throw new Error('Acesso negado: registro de sessão requer autenticação válida (auth.uid requerido)');
    }

    // Trigger de proteção no INSERT (protect_user_session_insert)
    const row = { ...payload };
    row.auth_uid = this.currentContext.uid; // Servidor força auth.uid()
    row.session_id = row.session_id || this.currentContext.uid;
    row.first_seen = row.first_seen || new Date().toISOString();
    row.last_seen = new Date().toISOString();
    row.updated_at = new Date().toISOString();

    if (!this.isManager()) {
      row.role = this.currentContext.role;
      row.is_blocked = false;
      row.has_custom_permissions = false;
      row.custom_layer_permissions = null;
      row.custom_feature_permissions = null;
    }

    this.userSessions.set(row.session_id, row);
    return row;
  }

  updateSession(sessionId, updates) {
    if (!this.currentContext || !this.currentContext.uid) {
      throw new Error('Acesso negado: atualização de sessão requer autenticação válida');
    }

    const oldRow = this.userSessions.get(sessionId);
    if (!oldRow) throw new Error('Sessão não encontrada');

    // RLS: sessões só atualizáveis pelo próprio auth_uid ou por gerentes/master
    if (oldRow.auth_uid !== this.currentContext.uid && !this.isManager()) {
      throw new Error('Acesso negado por RLS: você só pode atualizar sua própria sessão');
    }

    // Trigger de proteção no UPDATE (protect_user_session_update)
    const newRow = { ...oldRow, ...updates };
    newRow.auth_uid = oldRow.auth_uid; // Imutável
    newRow.session_id = oldRow.session_id; // Imutável
    newRow.first_seen = oldRow.first_seen;
    newRow.updated_at = new Date().toISOString();

    if (!this.isManager()) {
      newRow.role = oldRow.role;
      newRow.is_blocked = oldRow.is_blocked;
      newRow.has_custom_permissions = oldRow.has_custom_permissions;
      newRow.custom_layer_permissions = oldRow.custom_layer_permissions;
      newRow.custom_feature_permissions = oldRow.custom_feature_permissions;
    }

    this.userSessions.set(sessionId, newRow);
    return newRow;
  }

  selectSessions() {
    if (!this.currentContext) {
      return []; // Anon não lê nada
    }

    const results = [];
    for (const session of this.userSessions.values()) {
      // RLS: (auth_uid = auth.uid() OR public.is_manager())
      if (session.auth_uid === this.currentContext.uid || this.isManager()) {
        results.push(session);
      }
    }
    return results;
  }

  deleteSession(sessionId) {
    if (!this.isMaster()) {
      throw new Error('Acesso negado por RLS: exclusão de sessões permitida apenas ao Administrador Master');
    }
    this.userSessions.delete(sessionId);
    return true;
  }

  // --- REGRAS DE AUDITORIA (public.webgis_logs) ---

  insertLog(payload) {
    if (!this.currentContext || !this.currentContext.uid) {
      throw new Error('Acesso negado: logs de auditoria exigem autenticação válida');
    }

    // Validação de restrições de tamanho (chk_webgis_logs_*_len)
    if (payload.action && payload.action.length > 150) {
      throw new Error('Violação de restrição: ação excede 150 caracteres (chk_webgis_logs_action_len)');
    }
    if (payload.details && payload.details.length > 2500) {
      throw new Error('Violação de restrição: detalhes excedem 2500 caracteres (chk_webgis_logs_details_len)');
    }
    if (payload.category && payload.category.length > 50) {
      throw new Error('Violação de restrição: categoria excede 50 caracteres (chk_webgis_logs_category_len)');
    }

    // Taxa limite (Rate Limiting: máx 60 logs/min por usuário)
    const oneMinAgo = Date.now() - 60000;
    const recentCount = this.logs.filter(
      l => l.actor_id === this.currentContext.uid && new Date(l.created_at).getTime() > oneMinAgo
    ).length;

    if (recentCount >= 60) {
      throw new Error('Limite de taxa de auditoria excedido (máximo 60 logs/min por sessão)');
    }

    // Trigger de proteção e enriquecimento no INSERT (protect_and_enrich_log_insert)
    const log = {
      id: payload.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      formatted_date: new Date().toLocaleString('pt-BR'),
      user_role: this.currentContext.role, // Derivado do perfil real no servidor
      category: payload.category || 'ACESSO',
      action: payload.action,
      details: payload.details || null,
      session_id: payload.session_id || this.currentContext.uid,
      actor_id: this.currentContext.uid, // Servidor atribui auth.uid(), ignorando payload forjado
      created_at: new Date().toISOString()
    };

    this.logs.push(log);
    return log;
  }

  selectLogs() {
    // RLS: logs_select_policy USING (public.is_manager())
    if (!this.isManager()) {
      return []; // Usuário comum e visitante não têm permissão para ler logs
    }
    return [...this.logs];
  }

  updateLog() {
    // RLS: logs_update_policy USING (false)
    throw new Error('Acesso negado: logs de auditoria são estritamente imutáveis');
  }

  deleteLogs() {
    // RLS: logs_delete_policy USING (public.is_master())
    if (!this.isMaster()) {
      throw new Error('Acesso negado por RLS: exclusão de logs de auditoria permitida apenas ao Administrador Master');
    }
    const count = this.logs.length;
    this.logs = [];
    return count;
  }

  // --- TELEMETRIA REAL (get_telemetry_active_sessions) ---

  getTelemetryActiveSessions() {
    if (!this.isManager()) {
      throw new Error('Acesso negado: apenas gerentes e o Administrador Master podem consultar a telemetria do sistema');
    }

    const results = [];
    const threeMinAgo = Date.now() - 3 * 60 * 1000;

    for (const [userId, user] of this.authUsers.entries()) {
      const profile = this.profiles.get(userId);
      const session = Array.from(this.authSessions.values()).find(s => s.user_id === userId);
      const ws = Array.from(this.userSessions.values()).find(s => s.auth_uid === userId);

      // Gerente não vê master
      if (!this.isMaster() && profile?.role === 'master') {
        continue;
      }

      const lastActivityTime = ws ? new Date(ws.last_seen).getTime() : (session ? new Date(session.updated_at).getTime() : new Date(user.last_sign_in_at).getTime());
      const isOnline = lastActivityTime > threeMinAgo;

      // Mascarar IP se não for Master
      let ip = session?.ip || '0.0.0.0';
      if (!this.isMaster()) {
        ip = ip.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, '$1.$2.***.***');
      }

      results.push({
        auth_uid: userId,
        session_id: ws?.session_id || userId,
        username: profile?.username || 'anonimo',
        display_name: ws?.custom_name || profile?.name || 'Visitante',
        role: profile?.role || ws?.role || (user.is_anonymous ? 'visitor' : 'user'),
        is_anonymous: user.is_anonymous,
        ip_address: ip,
        user_agent: session?.user_agent || 'Desconhecido',
        is_online: isOnline,
        is_blocked: profile?.is_active === false || !!ws?.is_blocked
      });
    }

    return results;
  }

  // --- ROTINA DE EXPURGO (cleanup_stale_telemetry_and_anonymous) ---

  cleanupStaleTelemetryAndAnonymous(anonRetentionDays = 30, logRetentionDays = 90) {
    if (!this.isMaster()) {
      throw new Error('Acesso negado: apenas o Administrador Master possui permissão de expurgo de dados');
    }

    const logCutoff = Date.now() - logRetentionDays * 86400000;
    const anonCutoff = Date.now() - anonRetentionDays * 86400000;

    // 1. Purge logs
    const initialLogCount = this.logs.length;
    this.logs = this.logs.filter(l => new Date(l.created_at).getTime() >= logCutoff);
    const purgedLogs = initialLogCount - this.logs.length;

    // 2. Purge anonymous users in auth.users
    let purgedAnonUsers = 0;
    for (const [uid, user] of this.authUsers.entries()) {
      if (user.is_anonymous && new Date(user.last_sign_in_at).getTime() < anonCutoff) {
        this.authUsers.delete(uid);
        this.authSessions.delete(uid);
        this.userSessions.delete(uid);
        purgedAnonUsers++;
      }
    }

    return {
      success: true,
      purged_logs: purgedLogs,
      purged_anon_users: purgedAnonUsers,
      anon_retention_days: anonRetentionDays,
      log_retention_days: logRetentionDays
    };
  }
}

// ================================================================
// EXECUÇÃO DA BATERIA DE TESTES
// ================================================================

function runTests() {
  const sim = new ServerSecuritySimulator();
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  console.log('================================================================');
  console.log('   TESTES DE SEGURANÇA: SESSÕES E AUDITORIA NO BANCO (SERVER-FIRST)  ');
  console.log('================================================================\n');

  // --- 1. Sessões: RLS e Isolamento de Visitantes ---
  console.log('--- 1. Isolamento de Sessões e Permissões RLS ---');

  // 1.1 Visitante anônimo cria sua própria sessão
  sim.setAuthContext('visitor_uuid_1');
  const visitorSession = sim.insertSession({
    session_id: 'session_vis_01',
    custom_name: 'Turista em Teresina'
  });
  assert(visitorSession.auth_uid === 'visitor_uuid_1', 'Sessão do visitante ligada obrigatoriamente a auth.uid()');
  assert(visitorSession.role === 'visitor', 'Papel do visitante derivado como visitor pelo servidor');

  // 1.2 Visitante tenta forjar auth_uid de outro usuário ao registrar sessão
  const forgedSession = sim.insertSession({
    session_id: 'session_forged',
    auth_uid: 'master_uuid',
    role: 'master'
  });
  assert(forgedSession.auth_uid === 'visitor_uuid_1', 'Servidor anulou auth_uid forjado e gravou auth.uid() real');
  assert(forgedSession.role === 'visitor', 'Servidor impediu visitante de auto-atribuir papel de master');

  // 1.3 Visitante lê suas próprias sessões
  const visSessions = sim.selectSessions();
  assert(visSessions.length > 0 && visSessions.every(s => s.auth_uid === 'visitor_uuid_1'), 'Visitante lê apenas suas próprias sessões via RLS');

  // 1.4 Usuário comum tenta ler todas as sessões
  sim.setAuthContext('user_uuid');
  sim.insertSession({ session_id: 'session_usr_01', custom_name: 'Servidor Público' });
  const userVisibleSessions = sim.selectSessions();
  assert(userVisibleSessions.every(s => s.auth_uid === 'user_uuid'), 'Usuário comum não visualiza sessões de outros usuários via RLS');

  // --- 2. Proteção contra Auto-Promoção e Heartbeat ---
  console.log('\n--- 2. Proteção contra Fraude em Sessão e Heartbeat ---');

  // 2.1 Usuário tenta elevar seu papel para master ou manager via UPDATE
  const updatedUserSession = sim.updateSession('session_usr_01', { role: 'master', is_blocked: false });
  assert(updatedUserSession.role === 'user', 'Trigger de UPDATE impediu usuário comum de se auto-promover a master');

  // 2.2 Usuário envia heartbeat curto (last_seen)
  const prevTime = updatedUserSession.last_seen;
  const heartbeatSession = sim.updateSession('session_usr_01', { last_seen: new Date().toISOString() });
  assert(heartbeatSession.last_seen >= prevTime, 'Heartbeat de presença atualizado com sucesso pelo dono da sessão');

  // 2.3 Usuário tenta atualizar sessão de terceiro
  let blockedCrossUpdate = false;
  try {
    sim.updateSession('session_vis_01', { custom_name: 'Hackeado' });
  } catch {
    blockedCrossUpdate = true;
  }
  assert(blockedCrossUpdate, 'RLS impede usuário de atualizar sessão de outro usuário');

  // --- 3. Logs de Auditoria Confiáveis (Server-First) ---
  console.log('\n--- 3. Auditoria Imutável e Integridade no Servidor ---');

  // 3.1 Visitante registra log legítimo
  sim.setAuthContext('visitor_uuid_1');
  const visLog = sim.insertLog({
    action: 'Busca por CNEFE no bairro Centro',
    category: 'BUSCA',
    actor_id: 'master_uuid', // Tentativa maliciosa de forjar autor
    user_role: 'master'      // Tentativa maliciosa de forjar papel
  });
  assert(visLog.actor_id === 'visitor_uuid_1', 'Trigger do servidor sobrescreveu actor_id forjado com auth.uid() real');
  assert(visLog.user_role === 'visitor', 'Trigger do servidor derivou user_role do token/perfil real');

  // 3.2 Não autenticado é bloqueado de gravar log
  sim.setAuthContext(null);
  let unauthLogBlocked = false;
  try {
    sim.insertLog({ action: 'Tentativa anônima sem token' });
  } catch {
    unauthLogBlocked = true;
  }
  assert(unauthLogBlocked, 'Gravação de log rejeitada para chamadas sem autenticação válida');

  // 3.3 Validação de tamanho de campos de auditoria
  sim.setAuthContext('user_uuid');
  let overflowBlocked = false;
  try {
    sim.insertLog({ action: 'A'.repeat(160) });
  } catch {
    overflowBlocked = true;
  }
  assert(overflowBlocked, 'Restrição de integridade chk_webgis_logs_action_len bloqueia logs com ação > 150 caracteres');

  // 3.4 Rate limiting (máximo 60 logs/min por usuário)
  let rateLimitHit = false;
  try {
    for (let i = 0; i < 65; i++) {
      sim.insertLog({ action: `Ação em lote #${i}`, category: 'MEDICAO' });
    }
  } catch (err) {
    if (err.message.includes('Limite de taxa')) rateLimitHit = true;
  }
  assert(rateLimitHit, 'Trigger barrou ataque de flood acionando teto de 60 logs/min por usuário');

  // --- 4. RLS de Leitura e Imutabilidade de Logs ---
  console.log('\n--- 4. Políticas RLS de Leitura e Imutabilidade de Logs ---');

  // 4.1 Usuário comum tenta ler os logs
  sim.setAuthContext('user_uuid');
  const userLogs = sim.selectLogs();
  assert(userLogs.length === 0, 'Usuário comum impedido de ler logs de auditoria via RLS');

  // 4.2 Gerente lê logs de auditoria
  sim.setAuthContext('manager_uuid');
  const managerLogs = sim.selectLogs();
  assert(managerLogs.length > 0, 'Gerente autorizado lê logs de auditoria de todo o sistema');

  // 4.3 Tentativa de UPDATE em log existente
  let updateLogBlocked = false;
  try {
    sim.updateLog();
  } catch {
    updateLogBlocked = true;
  }
  assert(updateLogBlocked, 'Logs são imutáveis (RLS proíbe qualquer UPDATE na tabela webgis_logs)');

  // 4.4 Gerente tenta excluir logs
  let managerDeleteBlocked = false;
  try {
    sim.deleteLogs();
  } catch {
    managerDeleteBlocked = true;
  }
  assert(managerDeleteBlocked, 'Gerente é estritamente proibido de excluir logs de auditoria');

  // --- 5. Telemetria do Servidor (RPC get_telemetry_active_sessions) ---
  console.log('\n--- 5. Telemetria Autorizada com Mascaramento de IP ---');

  // 5.1 Usuário comum tenta invocar a RPC de telemetria
  sim.setAuthContext('user_uuid');
  let rpcUnauthorized = false;
  try {
    sim.getTelemetryActiveSessions();
  } catch {
    rpcUnauthorized = true;
  }
  assert(rpcUnauthorized, 'Usuário comum barrado ao tentar acessar get_telemetry_active_sessions()');

  // 5.2 Gerente invoca telemetria: recebe sessões com IP mascarado
  sim.setAuthContext('manager_uuid');
  const managerTelemetry = sim.getTelemetryActiveSessions();
  assert(managerTelemetry.length > 0, 'Gerente recebe lista de sessões ativas com telemetria');
  const maskedIpSample = managerTelemetry.find(s => s.auth_uid === 'visitor_uuid_1')?.ip_address;
  assert(maskedIpSample && maskedIpSample.includes('***.***'), 'IP de conexões é devidamente mascarado para a visão de gerentes');

  // 5.3 Master invoca telemetria: recebe IP completo e vê cálculo de is_online (< 3 min)
  sim.setAuthContext('master_uuid');
  const masterTelemetry = sim.getTelemetryActiveSessions();
  const rawIpSample = masterTelemetry.find(s => s.auth_uid === 'visitor_uuid_1')?.ip_address;
  assert(rawIpSample && !rawIpSample.includes('***'), 'Administrador Master tem acesso ao IP real do dispositivo');
  const onlineCheck = masterTelemetry.find(s => s.auth_uid === 'visitor_uuid_1')?.is_online;
  assert(onlineCheck === true, 'Conceito de online agora confirmado (< 3 minutos desde último sinal)');

  // --- 6. Rotina de Retenção e Limpeza Segura ---
  console.log('\n--- 6. Retenção e Expurgo Automatizado (Master Apenas) ---');

  // 6.1 Gerente tenta acionar limpeza
  sim.setAuthContext('manager_uuid');
  let cleanupUnauthorized = false;
  try {
    sim.cleanupStaleTelemetryAndAnonymous(30, 90);
  } catch {
    cleanupUnauthorized = true;
  }
  assert(cleanupUnauthorized, 'Gerente barrado de acionar a função de expurgo');

  // 6.2 Master executa expurgo de visitantes inativos > 30 dias
  sim.setAuthContext('master_uuid');
  const purgeResult = sim.cleanupStaleTelemetryAndAnonymous(30, 90);
  assert(purgeResult.success && purgeResult.purged_anon_users > 0, 'Master executa expurgo com sucesso, removendo usuários anônimos inativos há mais de 30 dias');

  console.log('\n================================================================');
  console.log(`   RESULTADO FINAL: ${passed} PASSOU / ${failed} FALHOU`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
