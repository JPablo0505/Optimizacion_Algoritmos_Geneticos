"""
preparar_mapa.py — prepara los datos del mapa REAL del repartidor (slides 11 y 12).

No forma parte de la página: se corre una vez, a mano, y genera js/datos-mapa.js
(un .js y no un .json para que la página funcione también abriendo index.html
sin servidor).

Qué hace:
  1. Descarga de OpenStreetMap (Overpass, vía osmnx) la ubicación de ~60 barrios
     de Medellín y centros urbanos del Valle de Aburrá. Los barrios en OSM son
     puntos place=neighbourhood/suburb/village/town/city: se usa ese punto, que
     los mapeadores ubican en el centro del barrio. No se inventa ninguna
     coordenada: si un nombre no aparece en OSM, el script se detiene.
  2. Descarga solo las vías principales (motorway, trunk, primary, secondary,
     tertiary y sus enlaces) y el río Medellín. La red se trata SIN sentidos
     viales (grafo no dirigido) y osmnx la simplifica.
  3. Une cada barrio al nodo de vía más cercano y calcula con Dijkstra la
     distancia por calle entre cada par de barrios y el camino (polilínea
     simplificada con Douglas-Peucker).
  4. Verifica la orientación (Bello al norte, Envigado y Sabaneta al sur,
     El Poblado al oriente del río y Laureles al occidente).
  5. Escribe js/datos-mapa.js con coordenadas en metros (x al este, y al norte)
     redondeadas a 5 m, y avisa si pesa más de 2 MB.

Uso (desde la carpeta del proyecto):
    python -m venv .venv && .venv/Scripts/pip install -r herramientas/requirements.txt
    .venv/Scripts/python herramientas/preparar_mapa.py
    # si el servidor de Overpass está saturado, use un espejo:
    .venv/Scripts/python herramientas/preparar_mapa.py --overpass https://overpass.private.coffee/api

Datos © colaboradores de OpenStreetMap, licencia ODbL (https://www.openstreetmap.org/copyright).
"""
import argparse
import datetime
import json
import math
import os
import sys
import time
import unicodedata

import networkx as nx
import osmnx as ox
from shapely.geometry import LineString

# ---------------------------------------------------------------------------
# Barrios: nombre visible → (nombre exacto en OSM, tipos de "place" aceptados)
# ---------------------------------------------------------------------------
BARRIO = ["neighbourhood"]
COMUNA = ["suburb"]
PUEBLO = ["town", "city", "village"]
BARRIOS = {
    "Laureles": ("Laureles", BARRIO),
    "Belén": ("Belén", COMUNA),
    "El Poblado": ("El Poblado", BARRIO),
    "Robledo": ("Robledo", BARRIO),
    "Castilla": ("Castilla", COMUNA),
    "Aranjuez": ("Aranjuez", BARRIO),
    "Manrique": ("Manrique", COMUNA),
    "Buenos Aires": ("Buenos Aires", BARRIO),
    "La América": ("La América", BARRIO),
    "San Javier": ("San Javier Numero 1", BARRIO),
    "Guayabal": ("Guayabal", BARRIO),
    "La Candelaria": ("La Candelaria", BARRIO),
    "Boston": ("Boston", BARRIO),
    "Prado": ("Prado", BARRIO),
    "Estadio": ("Estadio", BARRIO),
    "Calasanz": ("Calasanz", BARRIO),
    "La Floresta": ("La Floresta", BARRIO),
    "Simón Bolívar": ("Simón Bolivar", BARRIO),
    "Conquistadores": ("Los Conquistadores", BARRIO),
    "Carlos E. Restrepo": ("Carlos E. Restrepo", BARRIO),
    "Manila": ("Manila", BARRIO),
    "Villa Hermosa": ("Villa Hermosa", BARRIO),
    "Santa Cruz": ("Santa Cruz", BARRIO),
    "Popular": ("Popular", BARRIO),
    "Doce de Octubre": ("Doce de Octubre", COMUNA),
    "Los Colores": ("Los Colores", BARRIO),
    "El Salvador": ("El Salvador", BARRIO),
    "Moravia": ("Moravia", BARRIO),
    "Pedregal": ("Pedregal", BARRIO),
    "Caribe": ("Caribe", BARRIO),
    "Las Palmas": ("Las Palmas", BARRIO),
    "El Tesoro": ("El Tesoro", BARRIO),
    "Patio Bonito": ("Patio Bonito", BARRIO),
    "Lalinde": ("Lalinde", BARRIO),
    "Castropol": ("Castropol", BARRIO),
    "Naranjal": ("Naranjal", BARRIO),
    "Suramericana": ("Suramericana", BARRIO),
    "Fátima": ("Fátima", BARRIO),
    "La Mota": ("La Mota", BARRIO),
    "Los Alpes": ("Los Alpes", BARRIO),
    "Trinidad": ("Trinidad", BARRIO),
    "Tricentenario": ("Tricentenario", BARRIO),
    "Kennedy": ("Kennedy", BARRIO),
    "Belalcázar": ("Belalcázar", BARRIO),
    "Enciso": ("Enciso", BARRIO),
    "Las Estancias": ("Las Estancias", BARRIO),
    "Rosales": ("Rosales", BARRIO),
    "Colón": ("Colón", BARRIO),
    "Pajarito": ("Pajarito", BARRIO),
    "Cabañas": ("Cabañas", BARRIO),
    "Loreto": ("Loreto", BARRIO),
    "Niquía": ("Niquía", BARRIO),
    "Bello": ("Bello", PUEBLO),
    "Itagüí": ("Itagüí", PUEBLO),
    "Envigado": ("Envigado", PUEBLO),
    "Sabaneta": ("Sabaneta", PUEBLO),
    "La Estrella": ("La Estrella", PUEBLO),
    "San Antonio de Prado": ("San Antonio de Prado", PUEBLO),
    "Altavista": ("Altavista", PUEBLO),
    "Santa Elena": ("Santa Elena", PUEBLO),
}

VIAS = ["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link",
        "secondary", "secondary_link", "tertiary", "tertiary_link"]
PRINCIPALES = {"motorway", "trunk", "primary"}     # se dibujan más gruesas
MARGEN = 0.012                                      # grados alrededor de los barrios (~1,3 km)
RES = 5                                             # resolución de las coordenadas guardadas (m)
TOL_RUTA = 20                                       # tolerancia Douglas-Peucker de los caminos (m)
TOL_VIA = 15                                        # tolerancia de las vías de fondo (m)
MAX_BYTES = 2 * 1024 * 1024


SERVIDORES = ["https://overpass-api.de/api", "https://overpass.private.coffee/api",
              "https://overpass.kumi.systems/api", "https://maps.mail.ru/osm/tools/overpass/api"]


def con_reintentos(descripcion, fn):
    """los servidores públicos de Overpass se saturan: se reintenta rotando servidores,
    con espera creciente. osmnx guarda en caché lo que ya descargó."""
    espera = 15
    for intento in range(12):
        ox.settings.overpass_url = SERVIDORES[intento % len(SERVIDORES)]
        try:
            print(f"{descripcion} ({ox.settings.overpass_url})…", flush=True)
            return fn()
        except Exception as e:                      # noqa: BLE001 — cualquier fallo de red
            print(f"  falló: {str(e).splitlines()[0][:120]}; reintento en {espera} s", flush=True)
            time.sleep(espera)
            espera = min(espera * 2, 240)
    sys.exit(f"No se pudo descargar: {descripcion}")


def sin_tildes(s):
    return unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode().lower().strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--overpass", default=None, help="URL de un servidor Overpass alternativo")
    ap.add_argument("--salida", default=os.path.join(os.path.dirname(__file__), "..", "js", "datos-mapa.js"))
    args = ap.parse_args()

    ox.settings.use_cache = True
    ox.settings.cache_folder = os.path.join(os.path.dirname(__file__), "cache_osm")
    ox.settings.requests_timeout = 300
    ox.settings.overpass_rate_limit = False
    if args.overpass:
        SERVIDORES.insert(0, args.overpass)

    # ---------------- 1. barrios ----------------
    caja = (-75.70, 6.12, -75.48, 6.37)            # (oeste, sur, este, norte): todo el centro del valle
    lugares = con_reintentos("Descargando barrios", lambda: ox.features_from_bbox(
        caja, tags={"place": ["city", "town", "village", "suburb", "neighbourhood"]}))
    lugares = lugares[lugares["name"].notna()].reset_index()
    lugares = lugares[lugares["element"] == "node"]
    barrios = []
    for visible, (nombre_osm, tipos) in BARRIOS.items():
        m = lugares[(lugares["name"].map(sin_tildes) == sin_tildes(nombre_osm)) & (lugares["place"].isin(tipos))]
        if len(m) != 1:
            sys.exit(f"'{nombre_osm}' ({tipos}) aparece {len(m)} veces en OSM: revise la lista")
        r = m.iloc[0]
        barrios.append({"nombre": visible, "lat": round(r.geometry.y, 6), "lon": round(r.geometry.x, 6),
                        "osm": f"node/{r['id']}", "tipo": r["place"]})
    print(f"  {len(barrios)} barrios")

    lat_min = min(b["lat"] for b in barrios) - MARGEN
    lat_max = max(b["lat"] for b in barrios) + MARGEN
    lon_min = min(b["lon"] for b in barrios) - MARGEN
    lon_max = max(b["lon"] for b in barrios) + MARGEN
    lat0, lon0 = (lat_min + lat_max) / 2, (lon_min + lon_max) / 2
    kx = 111320 * math.cos(math.radians(lat0))      # metros por grado de longitud
    ky = 110574                                      # metros por grado de latitud

    def a_metros(lon, lat):                          # x al este, y al norte, origen en la esquina SO
        return (lon - lon_min) * kx, (lat - lat_min) * ky

    for b in barrios:
        b["x"], b["y"] = a_metros(b["lon"], b["lat"])

    # ---------------- 2. vías y río ----------------
    filtro = '["highway"~"^(' + "|".join(VIAS) + ')$"]'
    G = con_reintentos("Descargando vías principales", lambda: ox.graph_from_bbox(
        (lon_min, lat_min, lon_max, lat_max), custom_filter=filtro, simplify=True, retain_all=False))
    U = ox.convert.to_undirected(G)                  # sin sentidos viales
    print(f"  {U.number_of_nodes()} nodos, {U.number_of_edges()} tramos")

    agua = con_reintentos("Descargando el río Medellín", lambda: ox.features_from_bbox(
        (lon_min, lat_min, lon_max, lat_max), tags={"waterway": "river"}))
    agua = agua[agua["name"].notna()]
    rio = agua[agua["name"].map(sin_tildes).str.contains("medellin|aburra")]
    if not len(rio):
        sys.exit("No se encontró el río Medellín en OSM")

    # ---------------- 3. barrio → nodo más cercano, Dijkstra ----------------
    nodos = {n: a_metros(d["x"], d["y"]) for n, d in U.nodes(data=True)}
    for b in barrios:
        n, dist = min(((n, math.hypot(p[0] - b["x"], p[1] - b["y"])) for n, p in nodos.items()),
                      key=lambda t: t[1])
        b["nodo"], b["enlace"] = n, dist
        if dist > 1500:
            print(f"  aviso: {b['nombre']} queda a {dist:.0f} m de la vía principal más cercana")

    def geometria_tramo(u, v):
        """puntos (en metros) del tramo u→v siguiendo la forma real de la vía"""
        datos = min(U.get_edge_data(u, v).values(), key=lambda d: d.get("length", 0))
        if "geometry" in datos:
            pts = [a_metros(x, y) for x, y in datos["geometry"].coords]
            if math.dist(pts[0], nodos[u]) > math.dist(pts[-1], nodos[u]):
                pts.reverse()
            return pts
        return [nodos[u], nodos[v]]

    print("Calculando caminos entre todos los pares (Dijkstra)…")
    n = len(barrios)
    dist = [[0.0] * n for _ in range(n)]
    caminos = {}
    for i, bi in enumerate(barrios):
        largos, rutas = nx.single_source_dijkstra(U, bi["nodo"], weight="length")
        for j in range(i + 1, n):
            bj = barrios[j]
            if bj["nodo"] not in largos:
                sys.exit(f"No hay camino entre {bi['nombre']} y {bj['nombre']}")
            d = largos[bj["nodo"]] + bi["enlace"] + bj["enlace"]
            dist[i][j] = dist[j][i] = d
            camino = rutas[bj["nodo"]]
            pts = [(bi["x"], bi["y"]), nodos[camino[0]]]          # barrio → su vía más cercana
            for u, v in zip(camino, camino[1:]):
                pts.extend(geometria_tramo(u, v)[1:])            # cada tramo con su forma real
            pts.append((bj["x"], bj["y"]))
            caminos[(i, j)] = LineString(pts).simplify(TOL_RUTA).coords

    # ---------------- 4. orientación ----------------
    por = {b["nombre"]: b for b in barrios}
    puntos_rio = [a_metros(x, y) for g in rio.geometry if g.geom_type == "LineString" for x, y in g.coords]

    def x_rio(lat):                                  # x del río a la latitud dada (todos sus tramos)
        yb = (lat - lat_min) * ky
        cerca = sorted(p[0] for p in puntos_rio if abs(p[1] - yb) < 400)
        if not cerca:
            return min(puntos_rio, key=lambda p: abs(p[1] - yb))[0]
        return cerca[len(cerca) // 2]

    chequeos = [
        ("Bello al norte de La Candelaria", por["Bello"]["y"] > por["La Candelaria"]["y"]),
        ("Envigado al sur de El Poblado", por["Envigado"]["y"] < por["El Poblado"]["y"]),
        ("Sabaneta al sur de Envigado", por["Sabaneta"]["y"] < por["Envigado"]["y"]),
        ("El Poblado al oriente del río", por["El Poblado"]["x"] > x_rio(por["El Poblado"]["lat"])),
        ("Laureles al occidente del río", por["Laureles"]["x"] < x_rio(por["Laureles"]["lat"])),
    ]
    print(f"  río a la altura de El Poblado: x={x_rio(por['El Poblado']['lat']):.0f} m; "
          f"El Poblado x={por['El Poblado']['x']:.0f} m; Laureles x={por['Laureles']['x']:.0f} m")
    for texto, ok in chequeos:
        print(("  OK  " if ok else "  MAL ") + texto)
    if not all(ok for _, ok in chequeos):
        sys.exit("La orientación no es la esperada: revise la proyección")

    # ---------------- 5. escribir js/datos-mapa.js ----------------
    def plano(coords, tol=None):
        if tol:
            coords = LineString(coords).simplify(tol).coords
        out = []
        for x, y in coords:
            out += [int(round(x / RES)), int(round(y / RES))]
        return out

    vias_p, vias_s = [], []
    for u, v, d in U.edges(data=True):
        pts = geometria_tramo(u, v)
        tipo = d.get("highway")
        tipo = tipo[0] if isinstance(tipo, list) else tipo
        (vias_p if str(tipo).replace("_link", "") in PRINCIPALES else vias_s).append(plano(pts, TOL_VIA))
    rio_pts = []
    for g in rio.geometry:
        if g.geom_type == "LineString":
            rio_pts.append(plano([a_metros(x, y) for x, y in g.coords], TOL_VIA))

    datos = {
        "fuente": "© colaboradores de OpenStreetMap (ODbL). Barrios: nodos place=*; vías: "
                  + ", ".join(VIAS) + ". Red sin sentidos viales.",
        "generado": datetime.date.today().isoformat(),
        "res": RES,
        "ancho": int(round((lon_max - lon_min) * kx / RES)),
        "alto": int(round((lat_max - lat_min) * ky / RES)),
        "barrios": [{"nombre": b["nombre"], "lat": b["lat"], "lon": b["lon"], "osm": b["osm"],
                     "x": int(round(b["x"] / RES)), "y": int(round(b["y"] / RES))} for b in barrios],
        "dist": [round(dist[i][j]) for i in range(n) for j in range(i + 1, n)],   # metros, triángulo superior
        "caminos": [plano(caminos[(i, j)]) for i in range(n) for j in range(i + 1, n)],
        "vias": {"principales": vias_p, "secundarias": vias_s},
        "rio": rio_pts,
    }
    js = ("/* datos-mapa.js — GENERADO por herramientas/preparar_mapa.py; no lo edite a mano.\n"
          "   © colaboradores de OpenStreetMap (ODbL), https://www.openstreetmap.org/copyright\n"
          "   Coordenadas en unidades de " + str(RES) + " m: x al este, y al NORTE (origen en la esquina suroeste).\n"
          "   dist y caminos van en orden de pares (i, j) con i < j. */\n"
          "window.DATOS_MAPA = " + json.dumps(datos, ensure_ascii=False, separators=(",", ":")) + ";\n")
    salida = os.path.abspath(args.salida)
    with open(salida, "w", encoding="utf-8") as f:
        f.write(js)
    peso = os.path.getsize(salida)
    print(f"Escrito {salida}: {peso / 1024:.0f} KB, {n} barrios, {len(caminos)} caminos, "
          f"{len(vias_p) + len(vias_s)} tramos de vía")
    if peso > MAX_BYTES:
        print("AVISO: pesa más de 2 MB; quite 'tertiary' de VIAS o suba las tolerancias")


if __name__ == "__main__":
    main()
