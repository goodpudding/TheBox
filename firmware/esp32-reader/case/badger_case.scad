// The Box Badger — enclosure for ESP32 DevKitC (38-pin) + PN532 V3 (red board)
// + 2× 5 mm LEDs + 12 mm panel-mount Done button.  Two parts: base + lid.
//
// Render:  openscad -o base.stl -D 'part="base"' badger_case.scad
//          openscad -o lid.stl  -D 'part="lid"'  badger_case.scad
// Print:   PLA or PETG, 0.2 mm layers, 3 walls, no supports. Lid prints face-down
//          (as modelled); base prints as-is.
//
// Layout (plan view): ESP32 lies along X at the left end of the base; the PN532 is
// pegged to the underside of the lid at the right end, antenna reading through
// the lid. LEDs and button sit on the lid above the ESP32 end. USB exits the
// left end wall. Jumpers run inside the box between the two boards.
//
// Everything below is a parameter — measure your boards and adjust.

part = "both";          // "base" | "lid" | "both" (preview only)

// ---- ESP32 DevKitC (38-pin, KeeYees) -------------------------------------
esp_l = 55.5;           // PCB length (USB end to antenna end)
esp_w = 28.5;           // PCB width
esp_pcb = 1.6;
esp_pin_rows = 25.4;    // centre-to-centre of the two header rows
esp_under_pins = 3.2;   // pin stubs below the PCB
esp_top_stack = 17.0;   // header plastic + female Dupont housing above the PCB
usb_w = 13;             // USB cutout width
usb_h = 8;              // USB cutout height (from PCB top surface)

// ---- PN532 V3 red board ---------------------------------------------------
pn_l = 42.7;            // along X
pn_w = 40.4;            // along Y
pn_pcb = 1.6;
pn_hole_d = 3.2;        // its two mounting holes (diagonal corners)
pn_hole_inset = 4.0;    // hole centre distance from the two nearest edges
pn_below_stack = 16.0;  // pins + Dupont housings hanging below the board

// ---- Panel parts ----------------------------------------------------------
led_d = 5.4;            // 5 mm LED
button_d = 12.4;        // 12 mm panel-mount momentary button
screw_d = 2.6;          // M3 self-tapping pilot
screw_head_d = 6.2;
screw_head_h = 2.0;

// ---- Box ------------------------------------------------------------------
wall = 2.4;
floor_t = 2.0;
lid_t = 3.2;            // lid plate; the PN532 pocket leaves lid_t - pn_pcb over the antenna
clear = 0.6;            // fit clearance around PCBs
gap = 6;                // space between the two boards for the jumper bundle
post_d = 7;             // corner screw posts
corner_r = 3;

// derived
end_pad = 2;            // keeps the PN532 pocket clear of the lid lip
in_l = clear + esp_l + clear + gap + clear + pn_l + clear + end_pad;
in_w = 2*post_d + max(esp_w, pn_w) + 2*clear;   // posts live beside the boards
rail_h = esp_under_pins + 0.8;                   // rails lift the PCB above its pins
in_h = rail_h + esp_pcb + esp_top_stack + 5;     // base interior height (room for the button body)
out_l = in_l + 2*wall;
out_w = in_w + 2*wall;
base_h = floor_t + in_h;

esp_x0 = wall + clear;                           // ESP32 PCB origin (x)
esp_y0 = wall + (in_w - esp_w)/2;
pn_x0  = wall + clear + esp_l + clear + gap + clear;
pn_y0  = wall + (in_w - pn_w)/2;

post_xy = [[wall + post_d/2, wall + post_d/2],
           [out_l - wall - post_d/2, wall + post_d/2],
           [wall + post_d/2, out_w - wall - post_d/2],
           [out_l - wall - post_d/2, out_w - wall - post_d/2]];

$fn = 48;

module rrect(l, w, r, h) {
  linear_extrude(h) offset(r) offset(-r) square([l, w]);
}

module base() {
  difference() {
    union() {
      difference() {
        rrect(out_l, out_w, corner_r, base_h);
        translate([wall, wall, floor_t]) rrect(in_l, in_w, 1, in_h + 1);
      }
      // corner posts
      for (p = post_xy) translate([p[0], p[1], 0]) cylinder(d = post_d, h = base_h);
      // ESP32 rails: run along X, sit just inside the two pin rows
      for (s = [-1, 1])
        translate([esp_x0 - clear, esp_y0 + esp_w/2 + s*(esp_pin_rows/2 - 2.6) - 1.25, 0])
          cube([esp_l + 2*clear, 2.5, floor_t + rail_h]);
      // end stop so the board can't slide away from the USB wall
      translate([esp_x0 + esp_l + clear/2, esp_y0 + 3, 0])
        cube([1.6, esp_w - 6, floor_t + rail_h + esp_pcb + 2]);
      // side nubs keep the board from walking sideways
      for (s = [0, 1])
        translate([esp_x0 + esp_l/2 - 4, s == 0 ? esp_y0 - 1.6 - clear : esp_y0 + esp_w + clear, 0])
          cube([8, 1.6, floor_t + rail_h + esp_pcb + 2]);
    }
    // USB cutout in the left wall
    translate([-1, esp_y0 + esp_w/2 - usb_w/2, floor_t + rail_h + esp_pcb - 0.6])
      cube([wall + 2, usb_w, usb_h]);
    // screw pilots in the posts
    for (p = post_xy) translate([p[0], p[1], base_h - 10]) cylinder(d = screw_d, h = 11);
    // two keyhole slots in the floor for mounting the box to a surface
    for (x = [out_l*0.3, out_l*0.7]) {
      translate([x, out_w/2, -1]) cylinder(d = 7, h = floor_t + 2);
      translate([x - 2, out_w/2, -1]) cube([4, 8, floor_t + 2]);
    }
  }
}

module lid() {
  // modelled with the outside face at z=0 (print as-is, face down)
  // locating pegs through the PN532's two mounting holes
  for (h = pn_holes()) translate([h[0], h[1], lid_t - pn_pcb - 0.01]) cylinder(d = pn_hole_d - 0.3, h = pn_pcb + 1.2);
  difference() {
    union() {
      rrect(out_l, out_w, corner_r, lid_t);
      // inner lip that drops into the base
      translate([wall + 0.3, wall + 0.3, lid_t]) difference() {
        rrect(in_l - 0.6, in_w - 0.6, 1, 2.5);
        translate([1.6, 1.6, -1]) rrect(in_l - 0.6 - 3.2, in_w - 0.6 - 3.2, 1, 5);
      }
    }
    // PN532 pocket on the underside
    translate([pn_x0 - clear/2, pn_y0 - clear/2, lid_t - pn_pcb])
      cube([pn_l + clear, pn_w + clear, pn_pcb + 1]);
    // lip clearance around the base's corner posts
    for (p = post_xy) translate([p[0], p[1], lid_t - 0.01]) cylinder(d = post_d + 1.0, h = 4);
    // lid screws into the posts, countersunk from the outside
    for (p = post_xy) {
      translate([p[0], p[1], -1]) cylinder(d = screw_d + 0.6, h = lid_t + 5);
      translate([p[0], p[1], -1]) cylinder(d = screw_head_d, h = screw_head_h + 1);
    }
    // LEDs and button above the ESP32 end
    // (kept within the ~20 mm strip between the ESP32's header rows, where there
    //  are no Dupont housings — only the 3 mm tall module underneath)
    translate([esp_x0 + esp_l*0.22, out_w/2 + 6, -1]) cylinder(d = led_d, h = lid_t + 2);   // green
    translate([esp_x0 + esp_l*0.22, out_w/2 - 6, -1]) cylinder(d = led_d, h = lid_t + 2);   // red
    translate([esp_x0 + esp_l*0.62, out_w/2, -1]) cylinder(d = button_d, h = lid_t + 2);    // Done
    // tap target engraved over the antenna
    translate([pn_x0 + pn_l/2, pn_y0 + pn_w/2, -0.01]) difference() {
      cylinder(d = 30, h = 0.6);
      translate([0, 0, -1]) cylinder(d = 26, h = 3);
    }
  }
}

function pn_holes() = [
  [pn_x0 + pn_hole_inset,        pn_y0 + pn_w - pn_hole_inset],   // top-left of board
  [pn_x0 + pn_l - pn_hole_inset, pn_y0 + pn_hole_inset]           // bottom-right of board
];

if (part == "base") base();
if (part == "lid") lid();
if (part == "both") {
  base();
  translate([0, out_w + 10, 0]) lid();
}
