"""Independent stdlib reference, authored fixtures (not original course slides).

Physical cascade states [y, velocity, lag-filter, lead-filter], not the browser's
scaled companion realization. RK4 dt=0.0005 s; baseline also has an exact step.
Run: python src/modules/cd06/reference-fixtures.py
"""
import cmath
import json
import math


def loop_value(w, lag=None, lead=None, g=1, a=2, k=4):
    s = complex(0, w)
    value = g * k / (s * (s + a))
    if lag:
        z, p = lag
        value *= (s + z) / (s + p)
    if lead:
        z, p = lead
        value *= p / z * (s + z) / (s + p)
    return value


def crossover(lag=None, lead=None, g=1, a=2, k=4):
    lo, hi = 1e-8, 1e6
    for _ in range(150):
        mid = math.sqrt(lo * hi)
        if abs(loop_value(mid, lag, lead, g, a, k)) > 1:
            lo = mid
        else:
            hi = mid
    w = math.sqrt(lo * hi)
    return w, 180 + cmath.phase(loop_value(w, lag, lead, g, a, k)) * 180 / math.pi


def cascade_trace(lag=None, lead=None, g=1, a=2, k=4, horizon=40, dt=.0005):
    def derivative(x):
        y, velocity, qlag, qlead = x
        error = 1 - y
        lagout = error + (lag[0] - lag[1]) * qlag if lag else error
        u = k * lead[1] / lead[0] * (lagout + (lead[0] - lead[1]) * qlead) if lead else k * lagout
        return [velocity, g * u - a * velocity,
                error - lag[1] * qlag if lag else 0,
                lagout - lead[1] * qlead if lead else 0]

    x = [0., 0., 0., 0.]
    peak, last_outside, iae, old_error = 0., 0., 0., 1.
    for i in range(1, round(horizon / dt) + 1):
        k1 = derivative(x)
        k2 = derivative([v + dt * d / 2 for v, d in zip(x, k1)])
        k3 = derivative([v + dt * d / 2 for v, d in zip(x, k2)])
        k4 = derivative([v + dt * d for v, d in zip(x, k3)])
        x = [v + dt * (a1 + 2 * a2 + 2 * a3 + a4) / 6 for v, a1, a2, a3, a4 in zip(x, k1, k2, k3, k4)]
        peak = max(peak, x[0])
        error = abs(1 - x[0])
        iae += dt * (error + old_error) / 2
        old_error = error
        if error > .02:
            last_outside = i * dt
    return dict(overshoot=100 * (peak - 1), band_entry=last_outside + dt,
                ending_error=1 - x[0], iae=iae)


def cubic_one_real(coefficients):
    # A separate real Newton solve and quadratic deflation, not Durand–Kerner.
    _, a, b, c = coefficients
    r = -.1
    for _ in range(30):
        r -= ((r + a) * r * r + b * r + c) / (3 * r * r + 2 * a * r + b)
    u, v = a + r, -c / r
    d = cmath.sqrt(u * u - 4 * v)
    return [complex(r), (-u + d) / 2, (-u - d) / 2]


if __name__ == '__main__':
    for label, lag, lead in [('C0', None, None), ('lag', (.1, .02), None),
                             ('manual lead-lag', (.1, .02), (2, 4)),
                             ('changed corners', (.5, .1), None)]:
        w, pm = crossover(lag, lead)
        print(json.dumps(dict(case=label, crossover=w, phase_margin=pm,
                              ramp_error=.5 / (lag[0] / lag[1] if lag else 1),
                              **cascade_trace(lag, lead))))
    changed_lag = (.2, .04)
    w, pm = crossover(changed_lag, g=2, a=3, k=6)
    print(json.dumps(dict(case='changed plant', crossover=w, phase_margin=pm, ramp_error=.05,
                          **cascade_trace(changed_lag, g=2, a=3, k=6))))
    print('lag cubic poles:', cubic_one_real([1, 2.02, 4.04, .4]))
    print('full manual lead-lag poles: -2 plus', cubic_one_real([1, 4.02, 8.08, .8]))
    print('unstable-lag phase crossover:', math.sqrt(10 * 2 * .2 / (10 - 2 - .2)))
    print('critical proportional gain:', 2 * .2 * (2 + .2) / (10 - 2 - .2))
