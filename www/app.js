const STORAGE_KEYS = {
  PRODUCTOS: 'inv_almacen_productos_v1',
  HISTORIAL: 'inv_almacen_historial_v1',
  CONCILIACIONES: 'inv_almacen_conciliaciones_v1'
};

// Semilla inicial de prueba (3 productos; luego reemplazamos/ampliamos con los 609)
const PRODUCTOS_INICIALES_PRUEBA = [
  { id: 1, codigo: '35-469', nombre: 'EXPERT GROW LT', tipo_empaque: 'Cajas', factor_conversion: 1, cantidad_empaques: 0, cantidad_individual: 0, total: 0, ultima_actualizacion: '' },
  { id: 2, codigo: '35-18', nombre: 'N. MANCOZEB 80 WP', tipo_empaque: 'Cajas', factor_conversion: 1, cantidad_empaques: 0, cantidad_individual: 0, total: 0, ultima_actualizacion: '' },
  { id: 3, codigo: '35-381', nombre: '12-12-20-5S', tipo_empaque: 'Cajas', factor_conversion: 1, cantidad_empaques: 0, cantidad_individual: 0, total: 0, ultima_actualizacion: '' }
];

let productosCache = [];
let listaDiaria = [];

function getFechaHoy() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const d = String(hoy.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getFechaHoraActual() {
  return new Date().toLocaleString('es-DO', { hour12: true });
}

function calcularTotal(factor, empaques, individual) {
  const f = Number(factor) || 1;
  const e = Number(empaques) || 0;
  const i = Number(individual) || 0;
  return Number(((e * f) + i).toFixed(2));
}

function descomponerTotal(total, factor) {
  const f = Number(factor) || 1;
  const t = Math.max(0, Number(total) || 0);
  if (f <= 1) return { empaques: t, individual: 0 };
  const empaques = Math.floor(t / f);
  const individual = Number((t - (empaques * f)).toFixed(2));
  return { empaques, individual };
}

function mostrarToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3200);
}

// ==================== ALMACENAMIENTO LOCAL ====================
function registrarCorteHistorial(motivo = 'Actualización de inventario') {
  const fecha = getFechaHoy();
  const hora = getFechaHoraActual();
  const historial = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORIAL) || '[]');
  const snapshot = productosCache.map(p => ({ ...p }));

  const idx = historial.findIndex(h => h.fecha === fecha);
  const entrada = {
    fecha,
    modificado: hora,
    detalle: `${motivo} (${snapshot.length} productos)`,
    productos: snapshot
  };

  if (idx >= 0) {
    historial[idx] = entrada;
  } else {
    historial.unshift(entrada);
  }
  localStorage.setItem(STORAGE_KEYS.HISTORIAL, JSON.stringify(historial));
}

function guardarProductosLocal(motivo = 'Guardado') {
  productosCache.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  localStorage.setItem(STORAGE_KEYS.PRODUCTOS, JSON.stringify(productosCache));
  registrarCorteHistorial(motivo);
}

function cargarProductos() {
  const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTOS);
  if (!raw) {
    productosCache = PRODUCTOS_INICIALES_PRUEBA.map(p => ({ ...p, ultima_actualizacion: getFechaHoraActual() }));
    guardarProductosLocal('Carga inicial de prueba');
  } else {
    productosCache = JSON.parse(raw);
  }
  renderizarInventario(productosCache);
  actualizarDatalistDiario();
}

// ==================== NAVEGACIÓN ====================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'tab-historial') cargarHistorial();
  });
});

// ==================== ETIQUETAS Y CÁLCULO ====================
const etiquetasEmpaque = {
  Cajas: ['Cant. por Caja', 'Cantidad de Cajas'],
  Sacos: ['Peso/Cant. por Saco', 'Cantidad de Sacos'],
  Canecas: ['Litros por Caneca', 'Cantidad de Canecas'],
  Galones: ['Litros/Unid. por Galón', 'Cantidad de Galones'],
  Rollos: ['Metros por Rollo', 'Cantidad de Rollos'],
  Unidades: ['Factor (1)', 'Unidades Cerradas']
};

const selectTipo = document.getElementById('prod-tipo');
const inputFactor = document.getElementById('prod-factor');
const inputEmpaques = document.getElementById('prod-empaques');
const inputIndividual = document.getElementById('prod-individual');
const previewTotal = document.getElementById('preview-total');

function actualizarCalculoPreview() {
  const [lblF, lblE] = etiquetasEmpaque[selectTipo.value] || etiquetasEmpaque.Cajas;
  document.getElementById('lbl-factor').textContent = lblF;
  document.getElementById('lbl-empaques').textContent = lblE;
  previewTotal.textContent = calcularTotal(inputFactor.value, inputEmpaques.value, inputIndividual.value)
    .toFixed(2).replace(/\.00$/, '');
}

[selectTipo, inputFactor, inputEmpaques, inputIndividual].forEach(el => {
  el.addEventListener('input', actualizarCalculoPreview);
});

// ==================== INVENTARIO GENERAL ====================
function renderizarInventario(lista) {
  const tbody = document.getElementById('tabla-inventario-body');
  document.getElementById('contador-productos').textContent = lista.length;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-msg">Sin productos cargados.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(p => `
    <tr>
      <td><strong>${p.codigo}</strong></td>
      <td>${p.nombre}</td>
      <td>${p.tipo_empaque}</td>
      <td>${p.factor_conversion}</td>
      <td>${p.cantidad_empaques}</td>
      <td>${p.cantidad_individual}</td>
      <td><strong>${p.total}</strong></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="editarProducto(${p.id})">Editar</button>
        <button class="btn btn-danger" onclick="eliminarProducto(${p.id})">X</button>
      </td>
    </tr>
  `).join('');
}

document.getElementById('buscador-inventario').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtrados = productosCache.filter(p =>
    p.codigo.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q)
  );
  renderizarInventario(filtrados);
});

document.getElementById('form-producto').addEventListener('submit', (e) => {
  e.preventDefault();
  const idVal = document.getElementById('prod-id').value;
  const codigo = document.getElementById('prod-codigo').value.trim();
  const nombre = document.getElementById('prod-nombre').value.trim();
  const tipo_empaque = selectTipo.value;
  const factor_conversion = Number(inputFactor.value) || 1;
  const cantidad_empaques = Number(inputEmpaques.value) || 0;
  const cantidad_individual = Number(inputIndividual.value) || 0;
  const total = calcularTotal(factor_conversion, cantidad_empaques, cantidad_individual);
  const ultima_actualizacion = getFechaHoraActual();

  if (!codigo || !nombre) return alert('Código y nombre son obligatorios.');

  const duplicado = productosCache.find(p => p.codigo.toLowerCase() === codigo.toLowerCase() && String(p.id) !== String(idVal));
  if (duplicado) return alert('Ya existe un producto con ese código.');

  if (idVal) {
    const idx = productosCache.findIndex(p => String(p.id) === String(idVal));
    if (idx >= 0) {
      productosCache[idx] = {
        ...productosCache[idx],
        codigo, nombre, tipo_empaque, factor_conversion,
        cantidad_empaques, cantidad_individual, total, ultima_actualizacion
      };
    }
  } else {
    const maxId = productosCache.reduce((acc, p) => Math.max(acc, Number(p.id) || 0), 0);
    productosCache.push({
      id: maxId + 1,
      codigo, nombre, tipo_empaque, factor_conversion,
      cantidad_empaques, cantidad_individual, total, ultima_actualizacion
    });
  }

  guardarProductosLocal(idVal ? `Editado ${codigo}` : `Agregado ${codigo}`);
  resetFormulario();
  cargarProductos();
  mostrarToast('✅ Guardado en el almacenamiento local del teléfono');
});

window.editarProducto = function(id) {
  const p = productosCache.find(item => item.id === id);
  if (!p) return;
  document.getElementById('prod-id').value = p.id;
  document.getElementById('prod-codigo').value = p.codigo;
  document.getElementById('prod-nombre').value = p.nombre;
  selectTipo.value = p.tipo_empaque || 'Cajas';
  inputFactor.value = p.factor_conversion;
  inputEmpaques.value = p.cantidad_empaques;
  inputIndividual.value = p.cantidad_individual;
  document.getElementById('form-titulo').textContent = `Editando: ${p.nombre}`;
  document.getElementById('btn-cancelar-edicion').classList.remove('hidden');
  actualizarCalculoPreview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.eliminarProducto = function(id) {
  if (!confirm('¿Eliminar este producto del inventario?')) return;
  productosCache = productosCache.filter(p => p.id !== id);
  guardarProductosLocal('Producto eliminado');
  cargarProductos();
  mostrarToast('🗑️ Producto eliminado');
};

function resetFormulario() {
  document.getElementById('form-producto').reset();
  document.getElementById('prod-id').value = '';
  selectTipo.value = 'Cajas';
  inputFactor.value = 1;
  document.getElementById('form-titulo').textContent = 'Agregar / Actualizar Producto';
  document.getElementById('btn-cancelar-edicion').classList.add('hidden');
  actualizarCalculoPreview();
}
document.getElementById('btn-cancelar-edicion').addEventListener('click', resetFormulario);

// ==================== INVENTARIO DIARIO ====================
function actualizarDatalistDiario() {
  const dl = document.getElementById('datalist-productos');
  dl.innerHTML = productosCache.map(p => `<option value="${p.codigo} - ${p.nombre}">`).join('');
}

document.getElementById('btn-agregar-diario').addEventListener('click', () => {
  const val = document.getElementById('buscar-para-diario').value.trim().toLowerCase();
  if (!val) return;
  const prod = productosCache.find(p =>
    `${p.codigo} - ${p.nombre}`.toLowerCase() === val ||
    p.codigo.toLowerCase() === val ||
    p.nombre.toLowerCase().includes(val)
  );
  if (!prod) return alert('Producto no encontrado.');
  if (listaDiaria.some(i => i.id === prod.id)) return alert('Ya está en la lista de hoy.');

  listaDiaria.push({
    id: prod.id,
    codigo: prod.codigo,
    nombre: prod.nombre,
    stock_sistema: Number(prod.total),
    vendido_ayer: 0,
    conteo_fisico: Number(prod.total)
  });

  document.getElementById('buscar-para-diario').value = '';
  renderizarTablaDiaria();
});

function renderizarTablaDiaria() {
  const tbody = document.getElementById('tabla-diario-body');
  if (listaDiaria.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-msg">Aún no has agregado productos a la revisión diaria.</td></tr>`;
    return;
  }

  tbody.innerHTML = listaDiaria.map((item, idx) => {
    const esperado = Number((item.stock_sistema - item.vendido_ayer).toFixed(2));
    const diff = Number((item.conteo_fisico - esperado).toFixed(2));
    const claseDiff = diff === 0 ? 'badge-ok' : (diff < 0 ? 'badge-faltante' : 'badge-sobrante');
    const textoDiff = diff === 0 ? '0 (Cuadra)' : (diff > 0 ? `+${diff} (Sobra)` : `${diff} (Falta)`);

    return `
      <tr>
        <td><strong>${item.codigo}</strong></td>
        <td>${item.nombre}</td>
        <td>${item.stock_sistema}</td>
        <td><input type="number" inputmode="decimal" step="any" class="input-mini" value="${item.vendido_ayer}" onchange="actualizarFilaDiaria(${idx}, 'vendido', this.value)" /></td>
        <td><strong>${esperado}</strong></td>
        <td><input type="number" inputmode="decimal" step="any" class="input-mini" value="${item.conteo_fisico}" onchange="actualizarFilaDiaria(${idx}, 'fisico', this.value)" /></td>
        <td class="${claseDiff}">${textoDiff}</td>
        <td><button class="btn btn-danger" onclick="quitarFilaDiaria(${idx})">X</button></td>
      </tr>
    `;
  }).join('');
}

window.actualizarFilaDiaria = function(idx, campo, valor) {
  const num = parseFloat(valor) || 0;
  if (campo === 'vendido') {
    listaDiaria[idx].vendido_ayer = num;
    listaDiaria[idx].conteo_fisico = Math.max(0, Number((listaDiaria[idx].stock_sistema - num).toFixed(2)));
  } else {
    listaDiaria[idx].conteo_fisico = num;
  }
  renderizarTablaDiaria();
};

window.quitarFilaDiaria = function(idx) {
  listaDiaria.splice(idx, 1);
  renderizarTablaDiaria();
};

document.getElementById('btn-confirmar-conciliacion').addEventListener('click', () => {
  if (listaDiaria.length === 0) return alert('Agrega al menos un producto a la revisión diaria.');
  const horaActual = getFechaHoraActual();
  const registros = JSON.parse(localStorage.getItem(STORAGE_KEYS.CONCILIACIONES) || '[]');

  listaDiaria.forEach(item => {
    const prodIdx = productosCache.findIndex(p => p.id === item.id);
    if (prodIdx >= 0) {
      const prod = productosCache[prodIdx];
      const stockSistema = Number(prod.total);
      const vendidoAyer = Number(item.vendido_ayer) || 0;
      const stockEsperado = Number((stockSistema - vendidoAyer).toFixed(2));
      const conteoFisico = Number(item.conteo_fisico) || 0;
      const diferencia = Number((conteoFisico - stockEsperado).toFixed(2));

      registros.push({
        fecha: getFechaHoy(),
        codigo: prod.codigo,
        nombre: prod.nombre,
        stock_sistema: stockSistema,
        vendido_ayer: vendidoAyer,
        stock_esperado: stockEsperado,
        conteo_fisico: conteoFisico,
        diferencia
      });

      const { empaques, individual } = descomponerTotal(conteoFisico, prod.factor_conversion);
      productosCache[prodIdx] = {
        ...prod,
        cantidad_empaques: empaques,
        cantidad_individual: individual,
        total: conteoFisico,
        ultima_actualizacion: horaActual
      };
    }
  });

  localStorage.setItem(STORAGE_KEYS.CONCILIACIONES, JSON.stringify(registros));
  guardarProductosLocal(`Conciliación (${listaDiaria.length} ítems)`);
  listaDiaria = [];
  renderizarTablaDiaria();
  cargarProductos();
  mostrarToast('✅ Inventario diario conciliado y guardado');
});

// ==================== HISTORIAL LOCAL ====================
function cargarHistorial() {
  const historial = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORIAL) || '[]');
  const filtro = document.getElementById('filtro-fecha-excel').value;
  const filtrados = filtro ? historial.filter(h => h.fecha === filtro) : historial;

  const tbody = document.getElementById('tabla-historial-body');
  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">No hay registros en el historial para esa fecha.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map((h, i) => `
    <tr>
      <td><strong>${h.fecha}</strong></td>
      <td>${h.detalle}</td>
      <td>${h.modificado}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="exportarSnapshotExcel(${i})">Descargar .xlsx</button>
      </td>
    </tr>
  `).join('');
}

document.getElementById('filtro-fecha-excel').addEventListener('change', cargarHistorial);

window.exportarSnapshotExcel = function(index) {
  const historial = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORIAL) || '[]');
  const item = historial[index];
  if (!item) return;
  descargarXlsx(item.productos, `inventario_${item.fecha}.xlsx`, 'Inventario');
};

// ==================== EXCEL EN CLIENTE (SHEETJS) ====================
function descargarXlsx(listaProductos, nombreArchivo, nombreHoja = 'Inventario') {
  if (typeof XLSX === 'undefined') {
    return alert('No se cargó la librería XLSX. Verifica conexión o usa un archivo local de SheetJS.');
  }
  const filas = listaProductos.map(p => ({
    Codigo: p.codigo,
    Nombre: p.nombre,
    Tipo_Empaque: p.tipo_empaque,
    Cantidad_Por_Empaque: Number(p.factor_conversion) || 1,
    Cantidad_Empaques: Number(p.cantidad_empaques) || 0,
    Cantidades_Individuales: Number(p.cantidad_individual) || 0,
    Total_Inventario: Number(p.total) || 0,
    Ultima_Actualizacion: p.ultima_actualizacion || getFechaHoraActual()
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(filas);
  XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
  XLSX.writeFile(wb, nombreArchivo);
  mostrarToast(`📥 Descargado ${nombreArchivo}`);
}

document.getElementById('btn-descargar-plantilla').addEventListener('click', () => {
  const ejemplos = [
    { codigo: '35-000', nombre: 'AZUFRE (EJEMPLO CAJAS)', tipo_empaque: 'Cajas', factor_conversion: 4, cantidad_empaques: 2, cantidad_individual: 2, total: 10, ultima_actualizacion: getFechaHoraActual() },
    { codigo: '35-551', nombre: '20-20-10 45KG GRANULADO', tipo_empaque: 'Sacos', factor_conversion: 45, cantidad_empaques: 10, cantidad_individual: 15, total: 465, ultima_actualizacion: getFechaHoraActual() }
  ];
  descargarXlsx(ejemplos, 'plantilla_ejemplo_inventario.xlsx', 'Plantilla');
});

document.getElementById('btn-exportar-hoy').addEventListener('click', () => {
  descargarXlsx(productosCache, `inventario_${getFechaHoy()}.xlsx`, 'Inventario');
});

document.getElementById('form-importar').addEventListener('submit', (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('archivo-excel');
  if (!fileInput.files.length) return;
  if (typeof XLSX === 'undefined') return alert('Librería XLSX no disponible.');

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const hoja = wb.Sheets[wb.SheetNames[0]];
      const matriz = XLSX.utils.sheet_to_json(hoja, { header: 1 });

      let filaHeaderIdx = matriz.findIndex(row =>
        Array.isArray(row) && row.some(c => String(c || '').trim().toLowerCase() === 'codigo')
      );
      if (filaHeaderIdx === -1) filaHeaderIdx = 0;

      const filas = XLSX.utils.sheet_to_json(hoja, { range: filaHeaderIdx });
      const fecha = getFechaHoraActual();
      let maxId = productosCache.reduce((acc, p) => Math.max(acc, Number(p.id) || 0), 0);
      let procesados = 0;

      filas.forEach(fila => {
        const codigo = String(fila.Codigo || fila.codigo || '').trim();
        const nombre = String(fila.Nombre || fila.nombre || '').trim();
        if (!codigo || !nombre || codigo.toUpperCase() === 'TOTALES') return;

        const tipo_empaque = String(fila.Tipo_Empaque || fila.tipo_empaque || 'Cajas').trim();
        const factor_conversion = Number(fila.Cantidad_Por_Empaque || fila.factor_conversion || 1) || 1;
        const cantidad_empaques = Number(fila.Cantidad_Empaques || fila.cantidad_empaques || 0) || 0;
        const cantidad_individual = Number(fila.Cantidades_Individuales || fila.cantidad_individual || 0) || 0;
        const total = (fila.Total_Inventario !== undefined && fila.Total_Inventario !== '')
          ? Number(fila.Total_Inventario)
          : calcularTotal(factor_conversion, cantidad_empaques, cantidad_individual);

        const idxExistente = productosCache.findIndex(p => p.codigo.toLowerCase() === codigo.toLowerCase());
        if (idxExistente >= 0) {
          productosCache[idxExistente] = {
            ...productosCache[idxExistente],
            codigo, nombre, tipo_empaque, factor_conversion,
            cantidad_empaques, cantidad_individual, total, ultima_actualizacion: fecha
          };
        } else {
          maxId++;
          productosCache.push({
            id: maxId,
            codigo, nombre, tipo_empaque, factor_conversion,
            cantidad_empaques, cantidad_individual, total, ultima_actualizacion: fecha
          });
        }
        procesados++;
      });

      guardarProductosLocal(`Importación Excel (${procesados} ítems)`);
      fileInput.value = '';
      cargarProductos();
      mostrarToast(`✅ Se importaron ${procesados} productos`);
    } catch (err) {
      alert('Error al leer el Excel: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(fileInput.files[0]);
});

// Inicializar
actualizarCalculoPreview();
cargarProductos();