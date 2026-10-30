"""Authored CD04 fixtures; independent physical cascade, Python stdlib only.
Original Ch6/S08 slides unavailable/uninspected. Browser uses scaled companion
states; this reference uses [y, velocity, lag filter, lead filter].
"""
import json
import math


def trace(g=1, a=2, gain=4, lead=None, lag=None, horizon=80, dt=.0005):
    def derivative(x):
        y, velocity, q, r = x
        error = 1 - y
        lagout = error + (lag[0] - lag[1]) * q if lag else error
        u = gain * (lagout + (lead[0] - lead[1]) * r) if lead else gain * lagout
        return [velocity, g * u - a * velocity,
                error - lag[1] * q if lag else 0,
                lagout - lead[1] * r if lead else 0]

    x, peak, last, iae, old = [0., 0., 0., 0.], 0., 0., 0., 1.
    for i in range(1, round(horizon / dt) + 1):
        k1 = derivative(x)
        k2 = derivative([v + dt * d / 2 for v, d in zip(x, k1)])
        k3 = derivative([v + dt * d / 2 for v, d in zip(x, k2)])
        k4 = derivative([v + dt * d for v, d in zip(x, k3)])
        x = [v + dt * (a1 + 2 * a2 + 2 * a3 + a4) / 6 for v, a1, a2, a3, a4 in zip(x, k1, k2, k3, k4)]
        peak = max(peak, x[0])
        error = abs(1 - x[0])
        iae += dt * (old + error) / 2
        old = error
        if error > .02:
            last = i * dt
    return dict(overshoot=100 * (peak - 1), band_entry=last + dt, ending_error=1 - x[0], iae=iae)


if __name__ == '__main__':
    cases = [
        ('baseline C0', dict()),
        ('lead p6', dict(gain=12, lead=(8 / 3, 6))),
        ('combined lag .1', dict(gain=12, lead=(8 / 3, 6), lag=(.1, .1 / 3.75))),
        ('refined lag .02', dict(gain=12, lead=(8 / 3, 6), lag=(.02, .02 / 3.75))),
        ('changed lead p8', dict(gain=16, lead=(3, 8))),
        ('changed plant', dict(g=2, a=3, gain=6, lead=(14 / 3, 8), lag=(.1, 7 / 600))),
    ]
    for name, args in cases:
        print(json.dumps(dict(case=name, **trace(**args))))
    print('Exact lead poles: -4, -2 +/- 2j; K=12, z=8/3, ramp error=3/8.')
    print('Exact p8 lead poles: -6, -2 +/- 2j; K=16, z=3, ramp error=1/3.')
    print('Changed g2/a3/p8 lead: -7, -2 +/- 2j; K=6, z=14/3, ramp error=3/7.')
    print('Baseline exact overshoot:', 100 * math.exp(-math.pi / math.sqrt(3)))
