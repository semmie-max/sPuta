import re
import ast
from sympy import (
    symbols, Symbol, Eq, solve, diff, integrate, limit, oo, simplify,
    Matrix, laplace_transform, fourier_transform, Function, Derivative, dsolve
)
from sympy.parsing.sympy_parser import (
    parse_expr, standard_transformations, implicit_multiplication_application,
    convert_xor
)

TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application, convert_xor)

KNOWN_FUNCS = {
    "sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh",
    "exp", "log", "ln", "sqrt", "pi", "e", "Abs", "factorial"
}


def clean_input(text):
    text = text.strip()
    text = text.replace("^", "**")
    text = text.replace("÷", "/")
    text = text.replace("×", "*")
    return text


def safe_parse(expr_str):
    expr_str = clean_input(expr_str)
    return parse_expr(expr_str, transformations=TRANSFORMATIONS)


def is_math_question(text):
    t = text.lower()
    keywords = [
        "solve", "differentiate", "derivative", "integrate", "integral",
        "limit", "matrix", "determinant", "eigenvalue", "eigenvalues",
        "laplace", "fourier", "simplify", "factor", "expand", "evaluate",
        "differential equation", "ode"
    ]
    if any(k in t for k in keywords):
        return True
    if re.search(r"\b[a-zA-Z]'{1,3}(?![a-zA-Z])", text):
        return True
    if re.search(r"d\w+/d\w+", text):
        return True
    if re.search(r"[a-zA-Z]\s*=", text) and re.search(r"[+\-*/^]", text):
        return True
    if re.fullmatch(r"[\d\s+\-*/^().]+", text.strip()) and any(c.isdigit() for c in text):
        return True
    return False


def solve_equation(text):
    t = text
    if "solve" in t.lower():
        t = re.sub(r"solve", "", t, count=1, flags=re.IGNORECASE)
    parts = re.split(r"[;\n]| and ", t)
    eqs = []
    all_syms = set()
    for part in parts:
        part = part.strip()
        if not part or "=" not in part:
            continue
        lhs_str, rhs_str = part.split("=", 1)
        lhs = safe_parse(lhs_str)
        rhs = safe_parse(rhs_str)
        eq = Eq(lhs, rhs)
        eqs.append(eq)
        all_syms |= eq.free_symbols
    if not eqs:
        raise ValueError("No equation found")
    syms = sorted(all_syms, key=lambda s: s.name)
    result = solve(eqs if len(eqs) > 1 else eqs[0], syms)
    return {"method": "solve", "result": result, "symbols": [str(s) for s in syms]}


def do_derivative(text):
    match = re.search(
        r"(?:derivative of|differentiate)\s+(.*?)(?:\s+with respect to\s+(\w+)|\s+wrt\s+(\w+))?$",
        text, re.IGNORECASE
    )
    expr_str = match.group(1) if match else text
    wrt = (match.group(2) or match.group(3)) if match else None
    expr = safe_parse(expr_str)
    var = Symbol(wrt) if wrt else (
        sorted(expr.free_symbols, key=lambda s: s.name)[0] if expr.free_symbols else Symbol("x")
    )
    result = diff(expr, var)
    return {"method": "derivative", "result": result, "variable": str(var)}


def do_integral(text):
    bounds_match = re.search(r"from\s+(.+?)\s+to\s+(.+)$", text, re.IGNORECASE)
    lower = upper = None
    working = text
    if bounds_match:
        lower_str, upper_str = bounds_match.groups()
        working = text[:bounds_match.start()]
        lower = safe_parse(lower_str)
        upper = safe_parse(upper_str)
    match = re.search(r"(?:integrate|integral of)\s+(.*)", working, re.IGNORECASE)
    expr_str = match.group(1) if match else working
    expr = safe_parse(expr_str)
    var = sorted(expr.free_symbols, key=lambda s: s.name)[0] if expr.free_symbols else Symbol("x")
    if lower is not None and upper is not None:
        result = integrate(expr, (var, lower, upper))
    else:
        result = integrate(expr, var)
    return {"method": "integral", "result": result, "variable": str(var), "definite": lower is not None}


def do_limit(text):
    match = re.search(
        r"limit of\s+(.*?)\s+as\s+(\w+)\s*(?:->|approaches)\s*(.+)",
        text, re.IGNORECASE
    )
    if not match:
        raise ValueError("Could not parse limit")
    expr_str, varname, point_str = match.groups()
    expr = safe_parse(expr_str)
    var = Symbol(varname)
    point_str = point_str.strip().lower()
    if point_str in ("infinity", "inf", "+infinity"):
        point = oo
    elif point_str in ("-infinity", "-inf"):
        point = -oo
    else:
        point = safe_parse(point_str)
    result = limit(expr, var, point)
    return {"method": "limit", "result": result, "variable": str(var), "point": str(point)}


def do_matrix(text):
    bracket_match = re.search(r"\[\[.*\]\]", text)
    if not bracket_match:
        raise ValueError("Could not find a matrix")
    raw = bracket_match.group(0)
    data = ast.literal_eval(raw)
    m = Matrix(data)
    t = text.lower()
    if "determinant" in t:
        result, op = m.det(), "determinant"
    elif "inverse" in t:
        result, op = m.inv(), "inverse"
    elif "eigenvalue" in t:
        result, op = m.eigenvals(), "eigenvalues"
    elif "rank" in t:
        result, op = m.rank(), "rank"
    elif "transpose" in t:
        result, op = m.T, "transpose"
    else:
        result, op = m.det(), "determinant"
    return {"method": "matrix", "result": result, "operation": op}


def do_laplace(text):
    match = re.search(r"laplace(?: transform)? of\s+(.*)", text, re.IGNORECASE)
    expr_str = match.group(1) if match else text
    t, s = symbols("t s")
    expr = safe_parse(expr_str)
    result = laplace_transform(expr, t, s, noconds=True)
    return {"method": "laplace", "result": result}


def do_fourier(text):
    match = re.search(r"fourier(?: transform)? of\s+(.*)", text, re.IGNORECASE)
    expr_str = match.group(1) if match else text
    x, k = symbols("x k")
    expr = safe_parse(expr_str)
    result = fourier_transform(expr, x, k, noconds=True)
    return {"method": "fourier", "result": result}


def do_general(text):
    expr = safe_parse(text)
    result = simplify(expr)
    return {"method": "evaluate", "result": result}


def detect_ode_vars(text):
    dep, indep = "y", "x"
    leibniz = re.search(r"d(\w+)/d(\w+)", text)
    if leibniz:
        return leibniz.group(1), leibniz.group(2)
    prime = re.search(r"\b([a-zA-Z])'{1,3}(?![a-zA-Z])", text)
    if prime:
        dep = prime.group(1)
    return dep, indep


def convert_ode_notation(text, dep, indep):
    text = re.sub(rf"\b{dep}'''(?!\()", f"Derivative({dep}({indep}), {indep}, 3)", text)
    text = re.sub(rf"\b{dep}''(?!\()", f"Derivative({dep}({indep}), {indep}, 2)", text)
    text = re.sub(rf"\b{dep}'(?!\()", f"Derivative({dep}({indep}), {indep})", text)
    text = re.sub(rf"d\^?2{dep}/d{indep}\^?2", f"Derivative({dep}({indep}), {indep}, 2)", text)
    text = re.sub(rf"d{dep}/d{indep}", f"Derivative({dep}({indep}), {indep})", text)
    text = re.sub(rf"\b{dep}\b(?!\()", f"{dep}({indep})", text)
    return text


def do_ode(text):
    t = re.sub(r"^\s*solve\s*", "", text, flags=re.IGNORECASE)
    dep, indep = detect_ode_vars(t)

    ic_pattern = rf"{dep}(\'{{0,3}})\((-?\d+(?:\.\d+)?)\)\s*=\s*(-?\d+(?:\.\d+)?(?:/\d+)?)"
    ics_raw = re.findall(ic_pattern, t)
    t = re.sub(ic_pattern, "", t)
    t = t.strip().strip(",;")

    t = convert_ode_notation(t, dep, indep)

    if "=" not in t:
        raise ValueError("Could not find an equation to solve")
    lhs_str, rhs_str = t.split("=", 1)

    indep_sym = Symbol(indep)
    y_func = Function(dep)
    local_dict = {dep: y_func, indep: indep_sym, "Derivative": Derivative}

    lhs = parse_expr(lhs_str, transformations=TRANSFORMATIONS, local_dict=local_dict)
    rhs_str = rhs_str.strip()
    rhs = parse_expr(rhs_str, transformations=TRANSFORMATIONS, local_dict=local_dict) if rhs_str else 0

    equation = Eq(lhs, rhs)

    ics_kwargs = {}
    if ics_raw:
        ics_dict = {}
        for primes, point, value in ics_raw:
            order = len(primes)
            point_val = safe_parse(point)
            value_val = safe_parse(value)
            if order == 0:
                ics_dict[y_func(point_val)] = value_val
            else:
                deriv = y_func(indep_sym).diff(indep_sym, order)
                ics_dict[deriv.subs(indep_sym, point_val)] = value_val
        ics_kwargs["ics"] = ics_dict

    result = dsolve(equation, y_func(indep_sym), **ics_kwargs)
    return {"method": "ode", "result": result, "dependent": dep, "independent": indep}


def solve_math(text):
    t = text.lower()
    try:
        if ("differential equation" in t or "ode" in t
                or re.search(r"\b[a-zA-Z]'{1,3}(?![a-zA-Z])", text)
                or re.search(r"d\w+/d\w+", text)):
            data = do_ode(text)
        elif "matrix" in t or re.search(r"\[\[.*\]\]", text):
            data = do_matrix(text)
        elif "laplace" in t:
            data = do_laplace(text)
        elif "fourier" in t:
            data = do_fourier(text)
        elif "integrate" in t or "integral" in t:
            data = do_integral(text)
        elif "differentiate" in t or "derivative" in t:
            data = do_derivative(text)
        elif "limit" in t:
            data = do_limit(text)
        elif "=" in text:
            data = solve_equation(text)
        else:
            data = do_general(text)
        data["success"] = True
        data["result_str"] = str(data["result"])
        return data
    except Exception as e:
        return {"success": False, "error": str(e)}