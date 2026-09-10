"""
instance_reader.py
Reads a Bischoff-Ratcliff (BR) dataset JSON file and returns
a container dict and a flat list of item dicts.

BR JSON structure (confirmed from BR0/1.json):
  Objects[0]: { Length, Height, Depth, Stock, Cost }   <- the bin/container
  Items[]:    { Length, Height, Depth, C1_Length,
                C1_Height, C1_Depth, Demand, Value }   <- items to pack

C1_X == 1 means that dimension can participate in a rotation.
Demand is how many copies of this item type must be packed.
"""

import json


def load_instance(json_path):
    """
    Load a BR JSON file.

    Returns
    -------
    container : dict
        {'L': int, 'H': int, 'D': int}
    items : list of dict
        Each dict: {'L', 'H', 'D', 'can_rotate': bool, 'stop': int}
        The list is already expanded by Demand (one entry per physical item).
    """
    with open(json_path, 'r') as f:
        data = json.load(f)

    # ── Container ────────────────────────────────────────────────────────────
    obj = data['Objects'][0]
    container = {
        'L': int(obj['Length']),
        'H': int(obj['Height']),
        'D': int(obj['Depth']),
    }

    # ── Items (expanded by Demand) ────────────────────────────────────────────
    items = []
    box_counter = 1
    for item_def in data['Items']:
        demand = int(item_def.get('Demand') or 1)

        # An item may be rotated if any C1 flag is 1.
        # (C1_Height=1 means the item can be placed on its side in that axis.)
        can_rotate = bool(
            item_def.get('C1_Length', 0) or
            item_def.get('C1_Height', 0) or
            item_def.get('C1_Depth', 0)
        )

        L_val = int(item_def['Length'])
        H_val = int(item_def['Height'])
        D_val = int(item_def['Depth'])
        if can_rotate:
            seen = set()
            orients = []
            for perm in [(L_val, H_val, D_val), (L_val, D_val, H_val), (H_val, L_val, D_val),
                         (H_val, D_val, L_val), (D_val, L_val, H_val), (D_val, H_val, L_val)]:
                if perm not in seen:
                    seen.add(perm)
                    orients.append(perm)
        else:
            orients = [(L_val, H_val, D_val)]

        for _ in range(demand):
            item_entry = {
                'id': f"Box-{box_counter:03d}",
                'L': L_val,
                'H': H_val,
                'D': D_val,
                'can_rotate': can_rotate,
                'orientations': orients,
                'stop': int(item_def.get('Stop') or item_def.get('stop') or 1),
                'type': item_def.get('Type') or item_def.get('type') or 'Standard',
            }
            w_val = item_def.get('Weight') or item_def.get('weight')
            if w_val is not None:
                item_entry['weight'] = float(w_val)
            
            items.append(item_entry)
            box_counter += 1

    return container, items


# ── Quick smoke-test ──────────────────────────────────────────────────────────
if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("Usage: python instance_reader.py <path_to_instance.json>")
        sys.exit(1)

    c, its = load_instance(sys.argv[1])
    print(f"Container : L={c['L']}  H={c['H']}  D={c['D']}")
    print(f"Items     : {len(its)} total")
    vol_container = c['L'] * c['H'] * c['D']
    vol_items = sum(i['L'] * i['H'] * i['D'] for i in its)
    print(f"Volume fill ratio (lower bound): "
          f"{vol_items / vol_container:.2%}  "
          f"→ at least {-(-vol_items // vol_container)} bin(s) needed")
    print("First 3 items:", its[:3])