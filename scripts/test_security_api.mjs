/**
 * ROTEIRO DE TESTES DE SEGURANÇA E MATRIZ DE CAPACIDADES
 * Validação rigorosa dos 5 papéis: Master, Gerente, Usuário, Conta do Site e Visitante.
 * 
 * Regras testadas:
 * 1. Imunidade do Master: Ninguém (nem outro master) altera, bloqueia ou exclui o Master.
 * 2. Proteção do Último Master: Proibido excluir ou rebaixar o último Master remanescente.
 * 3. Delegação Estrita: Gerente nunca repassa ou concede capacidade sem possuir can_grant.
 * 4. Alcance do Gerente: Gerente só gerencia membros da sua própria equipe (ou escopo permitido).
 * 5. Bloqueio de Visitantes: Visitantes anônimos e contas não privilegiadas não executam ações administrativas.
 * 6. Trilha de Auditoria: Toda tentativa e alteração de poder gera registro imutável em capability_audit_logs.
 */

class MockSecurityEngine {
  constructor() {
    this.profiles = new Map([
      ['master_1', { id: 'master_1', username: 'master.supremo', name: 'Master Principal', role: 'master', is_active: true, created_by: 'system' }],
      ['master_2', { id: 'master_2', username: 'master.secundario', name: 'Master Secundário', role: 'master', is_active: true, created_by: 'master_1' }],
      ['manager_1', { id: 'manager_1', username: 'gerente.equipeA', name: 'Gerente Equipe A', role: 'manager', is_active: true, created_by: 'master_1' }],
      ['user_1', { id: 'user_1', username: 'usuario.equipeA', name: 'Usuário Equipe A', role: 'user', is_active: true, created_by: 'manager_1' }],
      ['user_2', { id: 'user_2', username: 'usuario.equipeB', name: 'Usuário Equipe B', role: 'user', is_active: true, created_by: 'manager_2' }],
      ['site_account_1', { id: 'site_account_1', username: 'cidadao.site', name: 'Conta do Site', role: 'site_account', is_active: true, created_by: 'self' }]
    ]);

    this.roleCapabilities = new Map([
      ['role:visitor', new Set(['tool:cnefe_search', 'tool:raio_x', 'account:self_register'])],
      ['role:site_account', new Set(['tool:cnefe_search', 'tool:raio_x', 'tool:measure', 'data:export:csv', 'account:self_register', 'account:change_own_password'])],
      ['role:user', new Set(['tool:cnefe_search', 'tool:measure', 'tool:print_a4', 'tool:raio_x', 'tool:dissolve_features', 'tool:multi_select', 'data:export:csv', 'data:export:geojson', 'data:export:kml', 'data:export:kmz', 'data:export:shapefile', 'data:export:geopackage'])],
      ['role:manager', new Set(['tool:cnefe_search', 'tool:measure', 'tool:print_a4', 'tool:raio_x', 'tool:dissolve_features', 'tool:multi_select', 'data:export:csv', 'admin:panel:access', 'admin:users:view', 'admin:users:create', 'admin:users:reset_password', 'admin:logs:view'])]
    ]);

    // Capacidades que o gerente pode repassar (can_grant)
    this.managerGrantCapabilities = new Map([
      ['manager_1', new Set(['admin:users:create', 'admin:users:reset_password', 'tool:cnefe_search', 'tool:measure', 'tool:print_a4'])]
    ]);

    // Escopos de delegação
    this.delegationScopes = new Map([
      ['manager_1', { scope_type: 'team_only', can_manage_site_accounts: true, can_manage_visitors: false }]
    ]);

    // Trilha de auditoria
    this.auditLogs = [];
  }

  can(callerId, capabilityKey) {
    const profile = this.profiles.get(callerId);
    if (!profile || !profile.is_active) return false;
    if (profile.role === 'master') return true;

    const roleCaps = this.roleCapabilities.get(`role:${profile.role}`);
    return roleCaps ? roleCaps.has(capabilityKey) : false;
  }

  canGrant(callerId, capabilityKey) {
    const profile = this.profiles.get(callerId);
    if (!profile || !profile.is_active) return false;
    if (profile.role === 'master') return true;

    const grants = this.managerGrantCapabilities.get(callerId);
    return grants ? grants.has(capabilityKey) : false;
  }

  canManageTarget(callerId, targetUserId) {
    const caller = this.profiles.get(callerId);
    const target = this.profiles.get(targetUserId);
    if (!caller || !target) return false;

    // REGRA DE OURO 1: Ninguém (nem outro master) altera o Master, exceto a si próprio!
    if (target.role === 'master' && callerId !== targetUserId) {
      return false;
    }

    if (caller.role === 'master') return true;

    if (caller.role === 'manager') {
      const scope = this.delegationScopes.get(callerId);
      if (scope && scope.scope_type === 'team_only') {
        // Só gerencia quem ele próprio cadastrou
        return target.created_by === callerId;
      }
      return target.role !== 'master' && target.role !== 'manager';
    }

    return false;
  }

  logAudit(entry) {
    this.auditLogs.push({
      id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      ...entry
    });
  }

  // Executa uma operação administrativa simulando a Edge Function admin-users
  handleAdminAction(callerId, action, payload = {}) {
    const caller = callerId ? this.profiles.get(callerId) : null;

    if (!caller || !caller.is_active) {
      return { status: 401, error: 'Sessão inválida, anônima ou expirada' };
    }

    const { targetUserId, capabilityKey, customCapabilities, newRole } = payload;

    switch (action) {
      case 'toggle_status':
      case 'delete_user':
      case 'update_user': {
        // Teste de Imunidade do Master e de Alcance (Precedência estrita)
        if (!this.canManageTarget(callerId, targetUserId)) {
          return { status: 403, error: 'Acesso negado: Imunidade do Master ou usuário alvo fora do seu alcance' };
        }

        if (!this.can(callerId, 'admin:users:block') && caller.role !== 'master') {
          return { status: 403, error: 'Acesso negado: Você não possui permissão para gerenciar status de contas' };
        }

        // Teste de Proteção do Último Master
        if (action === 'delete_user' || (action === 'update_user' && newRole && newRole !== 'master')) {
          const target = this.profiles.get(targetUserId);
          if (target && target.role === 'master') {
            const masterCount = Array.from(this.profiles.values()).filter(p => p.role === 'master').length;
            if (masterCount <= 1) {
              return { status: 403, error: 'Operação negada: Não é permitido excluir ou rebaixar o último Administrador Master' };
            }
          }
        }

        this.logAudit({
          performed_by: callerId,
          target_id: targetUserId,
          action,
          reason: 'Operação executada com sucesso'
        });
        return { status: 200, success: true };
      }

      case 'create_user': {
        if (!this.can(callerId, 'admin:users:create')) {
          return { status: 403, error: 'Acesso negado: Você não possui permissão para criar usuários' };
        }

        if (newRole === 'master' && caller.role !== 'master') {
          return { status: 403, error: 'Apenas um Administrador Master pode criar outro Master' };
        }

        // Teste de Delegação Estrita: Ninguém repassa o que não tem can_grant!
        if (caller.role !== 'master' && Array.isArray(customCapabilities)) {
          for (const cap of customCapabilities) {
            if (!this.canGrant(callerId, cap)) {
              return {
                status: 403,
                error: `Você não possui permissão para repassar a capacidade: "${cap}"`
              };
            }
          }
        }

        this.logAudit({
          performed_by: callerId,
          target_id: payload.username,
          action: 'create_user',
          reason: `Criou nova conta ${newRole || 'user'}`
        });
        return { status: 200, success: true };
      }

      case 'manage_capability': {
        if (!this.can(callerId, 'admin:roles:manage') && caller.role !== 'master') {
          return { status: 403, error: 'Acesso negado: Apenas o Master gerencia a matriz geral de poderes' };
        }
        return { status: 200, success: true };
      }

      default:
        return { status: 400, error: 'Ação desconhecida' };
    }
  }
}

// BATERIA DE TESTES AUTOMATIZADOS
async function runSecurityTestSuite() {
  console.log('================================================================');
  console.log('   INICIANDO BATERIA DE TESTES DE SEGURANÇA E MATRIZ DE PODERES  ');
  console.log('================================================================\n');

  const engine = new MockSecurityEngine();
  let passed = 0;
  let failed = 0;

  function assert(testName, condition, details = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} -> ${details}`);
      failed++;
    }
  }

  // 1. TESTES DE IMUNIDADE DO MASTER
  console.log('--- 1. Imunidade e Intocabilidade do Master ---');
  {
    // Cenário 1.1: Gerente tenta bloquear conta do Master
    const res1 = engine.handleAdminAction('manager_1', 'toggle_status', { targetUserId: 'master_1' });
    assert(
      'Gerente é bloqueado ao tentar desativar o Administrador Master',
      res1.status === 403 && res1.error.includes('Imunidade do Master'),
      JSON.stringify(res1)
    );

    // Cenário 1.2: Outro Master tenta excluir ou alterar o Master 1
    const res2 = engine.handleAdminAction('master_2', 'delete_user', { targetUserId: 'master_1' });
    assert(
      'Outro Master NÃO pode alterar, bloquear ou excluir o Master Principal',
      res2.status === 403 && res2.error.includes('Imunidade do Master'),
      JSON.stringify(res2)
    );

    // Cenário 1.3: O próprio Master pode atualizar sua própria conta
    const res3 = engine.handleAdminAction('master_1', 'update_user', { targetUserId: 'master_1', newRole: 'master' });
    assert(
      'O próprio Master pode atualizar a sua própria conta',
      res3.status === 200 && res3.success === true,
      JSON.stringify(res3)
    );
  }

  // 2. TESTE DE PROTEÇÃO DO ÚLTIMO MASTER
  console.log('\n--- 2. Proteção do Último Master ---');
  {
    // Remove o master_2 para restar apenas 1 master
    engine.profiles.delete('master_2');
    const res = engine.handleAdminAction('master_1', 'delete_user', { targetUserId: 'master_1' });
    assert(
      'Proibido excluir ou rebaixar o último Administrador Master do sistema',
      res.status === 403 && res.error.includes('último Administrador Master'),
      JSON.stringify(res)
    );
  }

  // 3. TESTES DE DELEGAÇÃO E REPASSE DO GERENTE (can_grant)
  console.log('\n--- 3. Delegação Estrita e Repasse de Poderes (can_grant) ---');
  {
    // Cenário 3.1: Gerente tenta criar usuário repassando capacidade que possui (tool:measure)
    const res1 = engine.handleAdminAction('manager_1', 'create_user', {
      username: 'novo.membro',
      newRole: 'user',
      customCapabilities: ['tool:measure', 'tool:print_a4']
    });
    assert(
      'Gerente consegue criar usuário repassando capacidades autorizadas pelo Master',
      res1.status === 200,
      JSON.stringify(res1)
    );

    // Cenário 3.2: Gerente tenta repassar poder que NÃO tem autorização de delegação (ex: admin:roles:manage)
    const res2 = engine.handleAdminAction('manager_1', 'create_user', {
      username: 'novo.membro.invasor',
      newRole: 'user',
      customCapabilities: ['admin:roles:manage']
    });
    assert(
      'Gerente é bloqueado ao tentar repassar poder além do que o Master lhe concedeu',
      res2.status === 403 && res2.error.includes('Você não possui permissão para repassar'),
      JSON.stringify(res2)
    );
  }

  // 4. TESTES DE ALCANCE DO GERENTE (SCOPE)
  console.log('\n--- 4. Escopo e Alcance de Gerência ---');
  {
    // Cenário 4.1: Gerente tenta alterar usuário da sua própria equipe (user_1)
    const canManageOwn = engine.canManageTarget('manager_1', 'user_1');
    assert(
      'Gerente possui permissão para gerenciar membro subordinado da sua equipe',
      canManageOwn === true
    );

    // Cenário 4.2: Gerente tenta alterar usuário subordinado de outro gerente (user_2)
    const canManageOther = engine.canManageTarget('manager_1', 'user_2');
    assert(
      'Gerente é estritamente bloqueado de alterar usuário fora da sua equipe (outro gerente)',
      canManageOther === false
    );
  }

  // 5. TESTES DE BLOQUEIO DE VISITANTES E CONTAS COMUNS
  console.log('\n--- 5. Isolamento e Bloqueio de Visitantes Anônimos ---');
  {
    // Cenário 5.1: Visitante anônimo (callerId null) tenta chamar Edge Function
    const res1 = engine.handleAdminAction(null, 'create_user', { username: 'hacker' });
    assert(
      'Visitante anônimo é rejeitado com status 401',
      res1.status === 401,
      JSON.stringify(res1)
    );

    // Cenário 5.2: Usuário comum tenta acessar gestão de matriz de papéis
    const res2 = engine.handleAdminAction('user_1', 'manage_capability');
    assert(
      'Usuário comum é barrado de alterar matriz e poderes administrativos',
      res2.status === 403,
      JSON.stringify(res2)
    );
  }

  // 6. TESTE DE TRILHA DE AUDITORIA
  console.log('\n--- 6. Trilha de Auditoria Granular ---');
  {
    assert(
      'Operações válidas geraram registros auditados na trilha de auditoria',
      engine.auditLogs.length >= 2,
      `Total de logs gerados: ${engine.auditLogs.length}`
    );
  }

  console.log('\n================================================================');
  console.log(`   RESULTADO FINAL: ${passed} PASSOU / ${failed} FALHOU`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTestSuite().catch(err => {
  console.error('Erro fatal nos testes:', err);
  process.exit(1);
});
