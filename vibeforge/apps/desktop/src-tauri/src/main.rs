// Undvik ett extra konsolfönster på Windows i release-byggen.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    vibeforge_desktop_lib::run()
}
