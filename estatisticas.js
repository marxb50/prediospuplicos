(function () {
  'use strict';

  var DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxknOR0N0KFBkfhWYJ5YtH_zj_sNmlMXjmQF6Cy7xmbwmf5Cg3IYs5zFQnP3hIAqkWB/exec';
  var HISTORY_URL = 'dados_historicos_2026.json';
  var COLORS = ['#005da4', '#00a3e0', '#ffc72c', '#11844a', '#7c57b8', '#df7d16', '#c7352d'];
  var query = new URLSearchParams(window.location.search);
  var gasUrl = query.get('gas') || localStorage.getItem('selim_gas_url') || DEFAULT_GAS_URL;
  var inputInicio = document.getElementById('inputInicio');
  var inputFim = document.getElementById('inputFim');
  var inputCategoria = document.getElementById('inputCategoria');
  var inputPredio = document.getElementById('inputPredio');
  var btnGenerate = document.getElementById('btnGenerate');
  var dashboardState = document.getElementById('dashboardState');
  var dashboardContent = document.getElementById('dashboardContent');
  var catalogBuildings = [];
  var allRecords = [];

  function pad(value) { return String(value).padStart(2, '0'); }
  function isoDate(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()); }
  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function normalizeText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function parseDate(record) {
    var iso = typeof record === 'string' ? record : String(record.dataIso || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(iso + 'T12:00:00');
    var raw = typeof record === 'string' ? record : String(record.dataExecucao || '');
    var match = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
    return match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12) : null;
  }
  function formatDate(date) {
    if (!date || isNaN(date.getTime())) return '—';
    return pad(date.getDate()) + '/' + pad(date.getMonth() + 1) + '/' + date.getFullYear();
  }
  function formatPeriod() {
    if (!inputInicio.value && !inputFim.value) return 'Todo o histórico registrado';
    var start = inputInicio.value ? formatDate(new Date(inputInicio.value + 'T12:00:00')) : 'início';
    var end = inputFim.value ? formatDate(new Date(inputFim.value + 'T12:00:00')) : 'hoje';
    return 'Período analisado: ' + start + ' a ' + end;
  }
  function daysBetween(a, b) { return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000)); }
  function addDays(date, days) { var copy = new Date(date.getTime()); copy.setDate(copy.getDate() + days); return copy; }
  function median(values) {
    if (!values.length) return null;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }
  function plural(count, singular, pluralText) { return count + ' ' + (count === 1 ? singular : pluralText); }
  function buildingKey(record) {
    return record.buildingId || (normalizeText(record.predioNome) + '|' + normalizeText(record.endereco));
  }

  function setPeriod(type) {
    var today = new Date();
    if (type === 'year') {
      inputInicio.value = today.getFullYear() + '-01-01';
      inputFim.value = today.getFullYear() + '-12-31';
    } else if (type === '90days') {
      var start = new Date(today.getTime());
      start.setDate(start.getDate() - 89);
      inputInicio.value = isoDate(start);
      inputFim.value = isoDate(today);
    } else if (type === 'all') {
      inputInicio.value = '';
      inputFim.value = '';
    }
    document.querySelectorAll('.preset').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-preset') === type);
    });
  }

  function mergeSources(historyData, apiRecords) {
    catalogBuildings = (historyData && Array.isArray(historyData.buildings) ? historyData.buildings : []).map(function (item) {
      return {
        id: item.id,
        category: item.category || 'Geral',
        name: item.name || 'Prédio não informado',
        address: item.address || 'Endereço não informado',
        executions: Array.isArray(item.executions) ? item.executions.slice() : []
      };
    });

    var buildingsByName = {};
    catalogBuildings.forEach(function (building) {
      var nameKey = normalizeText(building.name);
      if (!buildingsByName[nameKey]) buildingsByName[nameKey] = [];
      buildingsByName[nameKey].push(building);
    });

    function resolveBuilding(record) {
      var name = record.predioNome || 'Prédio não informado';
      var address = record.endereco || 'Endereço não informado';
      var candidates = buildingsByName[normalizeText(name)] || [];
      if (candidates.length === 1) return candidates[0];
      if (candidates.length > 1) {
        var addressKey = normalizeText(address);
        var exact = candidates.find(function (item) { return normalizeText(item.address) === addressKey; });
        if (exact) return exact;
      }
      var generated = {
        id: 'app-' + normalizeText(name).replace(/ /g, '-') + '-' + normalizeText(address).replace(/ /g, '-').slice(0, 45),
        category: record.categoria || 'Geral',
        name: name,
        address: address,
        executions: []
      };
      catalogBuildings.push(generated);
      if (!buildingsByName[normalizeText(name)]) buildingsByName[normalizeText(name)] = [];
      buildingsByName[normalizeText(name)].push(generated);
      return generated;
    }

    var merged = new Map();
    catalogBuildings.slice().forEach(function (building) {
      building.executions.forEach(function (executionDate) {
        merged.set(building.id + '|' + executionDate, {
          buildingId: building.id,
          dataIso: executionDate,
          dataExecucao: formatDate(parseDate(executionDate)),
          categoria: building.category,
          predioNome: building.name,
          endereco: building.address,
          origem: 'Histórico 2026'
        });
      });
    });

    (apiRecords || []).forEach(function (record) {
      var executionDate = parseDate(record);
      if (!executionDate) return;
      var building = resolveBuilding(record);
      var executionIso = isoDate(executionDate);
      merged.set(building.id + '|' + executionIso, {
        buildingId: building.id,
        timestamp: record.timestamp || '',
        dataIso: executionIso,
        dataExecucao: record.dataExecucao || formatDate(executionDate),
        categoria: building.category,
        predioNome: building.name,
        endereco: building.address,
        responsavel: record.responsavel || '',
        origem: 'Aplicativo'
      });
    });

    catalogBuildings.sort(function (a, b) {
      return a.category.localeCompare(b.category, 'pt-BR') || a.name.localeCompare(b.name, 'pt-BR', {numeric: true});
    });
    allRecords = Array.from(merged.values()).sort(function (a, b) { return b.dataIso.localeCompare(a.dataIso); });
  }

  function filterBuildings() {
    var category = normalizeText(inputCategoria.value);
    var buildingId = inputPredio.value;
    return catalogBuildings.filter(function (building) {
      if (category && normalizeText(building.category) !== category) return false;
      if (buildingId && building.id !== buildingId) return false;
      return true;
    });
  }

  function filterRecords(records) {
    var start = inputInicio.value ? new Date(inputInicio.value + 'T00:00:00') : null;
    var end = inputFim.value ? new Date(inputFim.value + 'T23:59:59') : null;
    var category = normalizeText(inputCategoria.value);
    var buildingId = inputPredio.value;
    return records.filter(function (record) {
      var date = parseDate(record);
      if (start && (!date || date < start)) return false;
      if (end && (!date || date > end)) return false;
      if (category && normalizeText(record.categoria) !== category) return false;
      if (buildingId && buildingKey(record) !== buildingId) return false;
      return true;
    });
  }

  function populateBuildingFilter() {
    var current = inputPredio.value;
    var category = normalizeText(inputCategoria.value);
    var buildings = catalogBuildings.filter(function (building) {
      return !category || normalizeText(building.category) === category;
    });
    var nameCounts = {};
    buildings.forEach(function (building) {
      var key = normalizeText(building.name);
      nameCounts[key] = (nameCounts[key] || 0) + 1;
    });
    inputPredio.innerHTML = '<option value="">Todos os prédios</option>' + buildings.map(function (building) {
      var label = building.name;
      if (nameCounts[normalizeText(building.name)] > 1) label += ' — ' + building.address;
      return '<option value="' + escapeHtml(building.id) + '">' + escapeHtml(label) + '</option>';
    }).join('');
    if (buildings.some(function (building) { return building.id === current; })) inputPredio.value = current;
  }

  function buildModels(records, buildings) {
    var groups = {};
    buildings.forEach(function (building) {
      groups[building.id] = {
        id: building.id,
        name: building.name,
        category: building.category,
        address: building.address,
        records: []
      };
    });
    records.forEach(function (record) {
      var key = buildingKey(record);
      if (!groups[key]) {
        groups[key] = {
          id: key,
          name: record.predioNome || 'Prédio não informado',
          category: record.categoria || 'Geral',
          address: record.endereco || 'Endereço não informado',
          records: []
        };
      }
      groups[key].records.push(record);
    });

    var categoryGaps = {};
    var globalGaps = [];
    Object.keys(groups).forEach(function (key) {
      var dates = groups[key].records.map(parseDate).filter(Boolean).sort(function (a, b) { return a - b; });
      var uniqueDates = dates.filter(function (date, index) { return index === 0 || date.getTime() !== dates[index - 1].getTime(); });
      var gaps = [];
      for (var i = 1; i < uniqueDates.length; i++) {
        var gap = daysBetween(uniqueDates[i - 1], uniqueDates[i]);
        if (gap > 0) gaps.push(gap);
      }
      groups[key].dates = uniqueDates;
      groups[key].gaps = gaps;
      if (!categoryGaps[groups[key].category]) categoryGaps[groups[key].category] = [];
      categoryGaps[groups[key].category] = categoryGaps[groups[key].category].concat(gaps);
      globalGaps = globalGaps.concat(gaps);
    });
    return {groups: groups, categoryGaps: categoryGaps, globalGaps: globalGaps};
  }

  function predictionFor(group, models) {
    var interval = median(group.gaps);
    var source = 'histórico do prédio';
    if (!interval) {
      interval = median(models.categoryGaps[group.category] || []);
      source = 'histórico da categoria';
    }
    if (!interval) {
      interval = median(models.globalGaps);
      source = 'histórico geral';
    }
    if (!interval) {
      interval = 30;
      source = 'ciclo inicial';
    }
    interval = Math.max(1, Math.round(interval));
    var last = group.dates[group.dates.length - 1] || null;
    return {interval: interval, source: source, last: last, next: last ? addDays(last, interval) : null};
  }

  function buildingRanking(records, buildings) {
    var counts = {};
    var latest = {};
    records.forEach(function (record) {
      var key = buildingKey(record);
      counts[key] = (counts[key] || 0) + 1;
      var date = parseDate(record);
      if (date && (!latest[key] || date > latest[key])) latest[key] = date;
    });
    return buildings.map(function (building) {
      return {
        key: building.id,
        name: building.name,
        category: building.category,
        address: building.address,
        count: counts[building.id] || 0,
        last: latest[building.id] || null
      };
    }).sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return (b.last ? b.last.getTime() : 0) - (a.last ? a.last.getTime() : 0) || a.name.localeCompare(b.name, 'pt-BR');
    });
  }

  function renderMonthlyChart(records) {
    var counts = {};
    records.forEach(function (record) {
      var date = parseDate(record);
      if (!date) return;
      var key = date.getFullYear() + '-' + pad(date.getMonth() + 1);
      counts[key] = (counts[key] || 0) + 1;
    });
    var start = inputInicio.value ? new Date(inputInicio.value + 'T12:00:00') : null;
    var end = inputFim.value ? new Date(inputFim.value + 'T12:00:00') : null;
    var keys = [];
    if (start && end) {
      var cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12);
      var endMonth = new Date(end.getFullYear(), end.getMonth(), 1, 12);
      while (cursor <= endMonth && keys.length < 60) {
        keys.push(cursor.getFullYear() + '-' + pad(cursor.getMonth() + 1));
        cursor.setMonth(cursor.getMonth() + 1);
      }
      if (keys.length > 12) keys = keys.slice(-12);
    } else {
      keys = Object.keys(counts).sort().slice(-12);
    }
    if (!keys.length) {
      var today = new Date();
      keys = [today.getFullYear() + '-' + pad(today.getMonth() + 1)];
    }
    var max = Math.max.apply(null, keys.map(function (key) { return counts[key] || 0; }).concat([1]));
    document.getElementById('monthlyChart').innerHTML = keys.map(function (key) {
      var parts = key.split('-');
      var date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
      var value = counts[key] || 0;
      var height = value ? Math.max(8, Math.round((value / max) * 150)) : 3;
      var label = date.toLocaleDateString('pt-BR', {month: 'short'}).replace('.', '') + '/' + String(parts[0]).slice(-2);
      return '<div class="month-column" title="' + escapeHtml(label + ': ' + value) + '"><span class="month-value">' + value + '</span><div class="month-bar" style="height:' + height + 'px"></div><span class="month-label">' + escapeHtml(label) + '</span></div>';
    }).join('');
    return counts;
  }

  function renderCategoryChart(records) {
    var counts = {};
    records.forEach(function (record) { var name = record.categoria || 'Geral'; counts[name] = (counts[name] || 0) + 1; });
    var items = Object.keys(counts).map(function (name) { return {name: name, value: counts[name]}; }).sort(function (a, b) { return b.value - a.value; });
    var total = records.length;
    var current = 0;
    var segments = items.map(function (item, index) {
      var start = current;
      current += total ? (item.value / total) * 100 : 0;
      return COLORS[index % COLORS.length] + ' ' + start.toFixed(2) + '% ' + current.toFixed(2) + '%';
    });
    var donut = document.getElementById('categoryDonut');
    donut.style.background = segments.length ? 'conic-gradient(' + segments.join(',') + ')' : '#e8eef4';
    donut.setAttribute('data-total', String(total));
    document.getElementById('categoryLegend').innerHTML = items.length ? items.map(function (item, index) {
      var percent = total ? Math.round((item.value / total) * 100) : 0;
      return '<div class="legend-item"><span class="legend-dot" style="background:' + COLORS[index % COLORS.length] + '"></span><span class="legend-name" title="' + escapeHtml(item.name) + '">' + escapeHtml(item.name) + '</span><span class="legend-value">' + item.value + ' · ' + percent + '%</span></div>';
    }).join('') : '<div class="empty-state">Sem categorias no período.</div>';
  }

  function renderCoverageChart(records, buildings) {
    var attended = new Set(records.map(buildingKey));
    var categories = {};
    buildings.forEach(function (building) {
      if (!categories[building.category]) categories[building.category] = {name: building.category, total: 0, attended: 0};
      categories[building.category].total++;
      if (attended.has(building.id)) categories[building.category].attended++;
    });
    var items = Object.keys(categories).map(function (key) {
      var item = categories[key];
      item.percent = item.total ? Math.round((item.attended / item.total) * 100) : 0;
      return item;
    }).sort(function (a, b) { return a.percent - b.percent || a.name.localeCompare(b.name, 'pt-BR'); });
    document.getElementById('coverageChart').innerHTML = items.length ? items.map(function (item) {
      return '<div class="coverage-row"><span class="coverage-name" title="' + escapeHtml(item.name) + '">' + escapeHtml(item.name) + '</span><div class="coverage-track"><div class="coverage-fill" style="width:' + item.percent + '%"></div></div><span class="coverage-value">' + item.attended + '/' + item.total + ' · ' + item.percent + '%</span></div>';
    }).join('') : '<div class="empty-state">Sem prédios para calcular a cobertura.</div>';
    return items;
  }

  function renderFrequencyChart(ranking) {
    var buckets = [
      {label: 'Nenhuma', value: 0}, {label: '1 vez', value: 0}, {label: '2 vezes', value: 0},
      {label: '3 vezes', value: 0}, {label: '4 vezes', value: 0}, {label: '5 ou mais', value: 0}
    ];
    ranking.forEach(function (item) { buckets[Math.min(item.count, 5)].value++; });
    var max = Math.max.apply(null, buckets.map(function (item) { return item.value; }).concat([1]));
    document.getElementById('frequencyChart').innerHTML = buckets.map(function (item) {
      var height = item.value ? Math.max(8, Math.round((item.value / max) * 145)) : 4;
      return '<div class="frequency-column"><span class="frequency-value">' + item.value + '</span><div class="frequency-bar" style="height:' + height + 'px"></div><span class="frequency-label">' + escapeHtml(item.label) + '</span></div>';
    }).join('');
  }

  function renderRankingChart(ranking) {
    var top = ranking.filter(function (item) { return item.count > 0; }).slice(0, 10);
    var max = top.length ? top[0].count : 1;
    document.getElementById('rankingChart').innerHTML = top.length ? top.map(function (item, index) {
      var width = Math.max(3, Math.round((item.count / max) * 100));
      return '<div class="rank-row"><span class="rank-name" title="' + escapeHtml(item.name) + '">' + (index + 1) + 'º · ' + escapeHtml(item.name) + '</span><div class="rank-track"><div class="rank-fill" style="width:' + width + '%"></div></div><span class="rank-value">' + plural(item.count, 'vez', 'vezes') + '</span></div>';
    }).join('') : '<div class="empty-state">Sem execuções no período selecionado.</div>';
  }

  function statusFor(nextDate, lastDate) {
    if (!lastDate) return {className: 'overdue', label: 'Sem execução registrada', priority: 0};
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var next = new Date(nextDate.getTime());
    next.setHours(0, 0, 0, 0);
    var difference = Math.ceil((next - today) / 86400000);
    if (difference < 0) return {className: 'overdue', label: 'Atrasada há ' + Math.abs(difference) + ' dias', priority: 1};
    if (difference <= 7) return {className: 'soon', label: difference === 0 ? 'Prevista para hoje' : 'Em ' + difference + ' dias', priority: 2};
    return {className: 'ok', label: 'Prevista', priority: 3};
  }

  function renderPlanning(ranking, models) {
    var attention = 0;
    var overdue = 0;
    var never = 0;
    var items = ranking.map(function (item) {
      var group = models.groups[item.key];
      var prediction = predictionFor(group, models);
      var status = statusFor(prediction.next, prediction.last);
      if (!prediction.last) { never++; attention++; }
      else if (status.className === 'overdue') { overdue++; attention++; }
      return {item: item, prediction: prediction, status: status};
    }).sort(function (a, b) {
      if (a.status.priority !== b.status.priority) return a.status.priority - b.status.priority;
      var aDate = a.prediction.next ? a.prediction.next.getTime() : 0;
      var bDate = b.prediction.next ? b.prediction.next.getTime() : 0;
      return aDate - bDate || a.item.name.localeCompare(b.item.name, 'pt-BR');
    });
    document.getElementById('planningTable').innerHTML = items.length ? items.map(function (entry, index) {
      var prediction = entry.prediction;
      var nextText = prediction.next ? formatDate(prediction.next) : 'Programar';
      return '<tr><td class="position">' + (index + 1) + 'º</td><td><strong>' + escapeHtml(entry.item.name) + '</strong><br><small>' + escapeHtml(entry.item.address) + '</small></td><td>' + escapeHtml(entry.item.category) + '</td><td>' + plural(entry.item.count, 'execução', 'execuções') + '</td><td>' + formatDate(prediction.last) + '</td><td>' + prediction.interval + ' dias<br><small>' + escapeHtml(prediction.source) + '</small></td><td><strong>' + nextText + '</strong></td><td><span class="status ' + entry.status.className + '">' + escapeHtml(entry.status.label) + '</span></td></tr>';
    }).join('') : '<tr><td colspan="8"><div class="empty-state">Sem prédios para planejar neste período.</div></td></tr>';
    return {attention: attention, overdue: overdue, never: never};
  }

  function renderDashboard() {
    populateBuildingFilter();
    var buildings = filterBuildings();
    var records = filterRecords(allRecords);
    var ranking = buildingRanking(records, buildings);
    var models = buildModels(allRecords, catalogBuildings);
    var monthlyCounts = renderMonthlyChart(records);
    renderCategoryChart(records);
    var coverageItems = renderCoverageChart(records, buildings);
    renderFrequencyChart(ranking);
    renderRankingChart(ranking);
    var planning = renderPlanning(ranking, models);
    var attended = ranking.filter(function (item) { return item.count > 0; });
    var coverage = buildings.length ? Math.round((attended.length / buildings.length) * 100) : 0;
    var leader = attended[0] || null;
    var monthEntries = Object.keys(monthlyCounts).map(function (key) { return {key: key, value: monthlyCounts[key]}; }).sort(function (a, b) { return b.value - a.value || a.key.localeCompare(b.key); });
    var bestMonth = monthEntries[0] || null;
    var bestMonthLabel = '—';
    if (bestMonth && bestMonth.value) {
      var parts = bestMonth.key.split('-');
      bestMonthLabel = new Date(Number(parts[0]), Number(parts[1]) - 1, 1).toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'});
    }
    var lowestCoverage = coverageItems[0] || null;

    document.getElementById('kpiExecutions').textContent = records.length;
    document.getElementById('kpiExecutionsDetail').textContent = formatPeriod();
    document.getElementById('kpiCatalog').textContent = buildings.length;
    document.getElementById('kpiCatalogDetail').textContent = inputCategoria.value ? inputCategoria.value : 'em todas as categorias';
    document.getElementById('kpiCoverage').textContent = coverage + '%';
    document.getElementById('kpiCoverageDetail').textContent = attended.length + ' de ' + buildings.length + ' atendidos';
    document.getElementById('kpiNever').textContent = Math.max(0, buildings.length - attended.length);
    document.getElementById('kpiNeverDetail').textContent = 'prédios sem limpeza no recorte';
    document.getElementById('kpiLeader').textContent = leader ? leader.name : '—';
    document.getElementById('kpiLeaderDetail').textContent = leader ? plural(leader.count, 'execução', 'execuções') : 'sem dados';
    document.getElementById('kpiAttention').textContent = planning.attention;
    document.getElementById('periodText').textContent = formatPeriod() + (inputCategoria.value ? ' • ' + inputCategoria.value : '') + (inputPredio.value ? ' • ' + (inputPredio.options[inputPredio.selectedIndex] || {}).text : '');
    document.getElementById('generatedText').textContent = 'Gerado em ' + new Date().toLocaleString('pt-BR') + ' • ' + allRecords.length + ' execuções consolidadas';

    document.getElementById('insightFrequency').innerHTML = leader ? '<strong>Maior frequência:</strong> ' + escapeHtml(leader.name) + ' lidera com ' + plural(leader.count, 'execução', 'execuções') + ' no período.' : '<strong>Maior frequência:</strong> sem dados para calcular.';
    document.getElementById('insightMonth').innerHTML = bestMonth && bestMonth.value ? '<strong>Mês de maior atividade:</strong> ' + escapeHtml(bestMonthLabel) + ', com ' + plural(bestMonth.value, 'execução', 'execuções') + '.' : '<strong>Mês de maior atividade:</strong> sem dados para calcular.';
    document.getElementById('insightCoverage').innerHTML = lowestCoverage ? '<strong>Menor cobertura:</strong> ' + escapeHtml(lowestCoverage.name) + ' tem ' + lowestCoverage.percent + '% dos prédios atendidos no período.' : '<strong>Cobertura:</strong> sem dados para calcular.';
    document.getElementById('insightPlanning').innerHTML = '<strong>Prioridades:</strong> ' + plural(planning.never, 'prédio nunca foi atendido', 'prédios nunca foram atendidos') + ' e ' + plural(planning.overdue, 'previsão está vencida', 'previsões estão vencidas') + '.';

    dashboardState.classList.add('hidden');
    dashboardContent.classList.remove('hidden');
  }

  function showError(message) {
    dashboardContent.classList.add('hidden');
    dashboardState.className = 'error-state';
    dashboardState.innerHTML = '<strong>' + escapeHtml(message) + '</strong> <button id="btnRetry" class="preset" type="button">Tentar novamente</button>';
    var retry = document.getElementById('btnRetry');
    if (retry) retry.addEventListener('click', loadData);
  }

  function fetchJson(url, params) {
    var requestParams = new URLSearchParams(params || {});
    requestParams.set('_ts', String(Date.now()));
    var separator = url.indexOf('?') > -1 ? '&' : '?';
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 60000);
    return fetch(url + separator + requestParams.toString(), {method: 'GET', mode: 'cors', cache: 'no-store', credentials: 'omit', signal: controller.signal})
      .then(function (response) { if (!response.ok) throw new Error('Resposta HTTP ' + response.status); return response.text(); })
      .then(function (text) { try { return JSON.parse(text); } catch (error) { throw new Error('O serviço retornou uma resposta inválida.'); } })
      .finally(function () { clearTimeout(timeout); });
  }

  function loadFromEndpoint(url) {
    return fetchJson(url, {acao: 'estatisticas'}).then(function (data) {
      if (data && data.status === 'success' && Array.isArray(data.registros)) return data;
      return fetchJson(url, {acao: 'relatorio'});
    });
  }

  function loadData() {
    dashboardContent.classList.add('hidden');
    dashboardState.className = 'loading-state';
    dashboardState.textContent = 'Consolidando o histórico do Excel e os registros recentes...';
    var candidates = [gasUrl, DEFAULT_GAS_URL].filter(function (url, index, list) { return url && list.indexOf(url) === index; });

    function tryCandidate(index) {
      if (index >= candidates.length) return Promise.resolve({status: 'success', registros: []});
      return loadFromEndpoint(candidates[index]).catch(function () { return tryCandidate(index + 1); });
    }

    Promise.all([
      fetchJson(HISTORY_URL, {}).catch(function () { return {buildings: []}; }),
      tryCandidate(0)
    ]).then(function (results) {
      var history = results[0] || {buildings: []};
      var live = results[1] || {registros: []};
      if (!Array.isArray(history.buildings) || !Array.isArray(live.registros)) throw new Error('Os dados recebidos estão incompletos.');
      mergeSources(history, live.registros);
      if (!catalogBuildings.length) throw new Error('Nenhum prédio foi encontrado nas fontes disponíveis.');
      renderDashboard();
    }).catch(function (error) { showError('Não foi possível gerar as estatísticas. ' + error.message); });
  }

  function renderIfReady() {
    if (catalogBuildings.length) renderDashboard();
  }

  document.querySelectorAll('.preset').forEach(function (button) {
    button.addEventListener('click', function () {
      var type = button.getAttribute('data-preset');
      if (type !== 'custom') setPeriod(type);
      else document.querySelectorAll('.preset').forEach(function (item) { item.classList.remove('active'); });
      renderIfReady();
    });
  });
  inputInicio.addEventListener('change', function () { document.querySelectorAll('.preset').forEach(function (item) { item.classList.remove('active'); }); renderIfReady(); });
  inputFim.addEventListener('change', function () { document.querySelectorAll('.preset').forEach(function (item) { item.classList.remove('active'); }); renderIfReady(); });
  inputCategoria.addEventListener('change', function () { inputPredio.value = ''; populateBuildingFilter(); renderIfReady(); });
  inputPredio.addEventListener('change', renderIfReady);
  btnGenerate.addEventListener('click', renderIfReady);
  document.getElementById('btnPrint').addEventListener('click', function () { window.print(); });

  if (query.get('inicio') || query.get('fim')) {
    inputInicio.value = query.get('inicio') || '';
    inputFim.value = query.get('fim') || '';
    document.querySelectorAll('.preset').forEach(function (item) { item.classList.remove('active'); });
  } else {
    setPeriod('year');
  }
  loadData();
}());
