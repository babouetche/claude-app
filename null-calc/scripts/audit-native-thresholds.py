"""Read-only, version-pinned audit of the supplied Null ROM's replacement helpers.

Uses only the Python standard library. Does not launch a game, read a save file,
copy a ROM, or claim equivalence of the full JavaScript and native battle engines.
The recorded disassembly is checked against exact ROM bytes; BL/branch targets
and PC-relative literals are also decoded independently below.
"""
import argparse
import datetime
import hashlib
import json
import os
import pathlib
import re
import struct
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
ROM_BASE = 0x08000000
ROM_SHA256 = 'a6f4f3f9d9b68515c70b134d6f0e79b3fd22e00c2f1468dbafa5b7529d98dbf4'
# Fixed development evidence; no external tools or live lookup required.
EXPECTED = json.loads(r'''{"capstoneVersion":"5.0.7","ranges":{"partyScore":{"start":"0x8081f70","endExclusive":"0x80822ca","sha256":"a44d1c96fea04b4533e3340b772779b395205436c9f9386c4dff6a6e4e9c8a46"},"aiDamage":{"start":"0x816bd00","endExclusive":"0x816c234","sha256":"6ce4d3e9ee495b66af8a38c091964b51680e1a439b16a3f1fbc01f75bd223a54"},"damageWrapper":{"start":"0x8058128","endExclusive":"0x805818c","sha256":"9c4cca5a1c421cfe53fcf1e14c6dfcdaa9904bfc0aef1dd1a6af1d186d6659af"},"damageCore":{"start":"0x8057a28","endExclusive":"0x8057ebc","sha256":"69e715926ab7052d4b0f61c644b8e2feb5553f0ce9e6d4966095ab170798d13f"},"hitsCeiling":{"start":"0x816c27c","endExclusive":"0x816c298","sha256":"86f8051f39b1178f828096e0209cb7a0ef769999163ce14b5ada9f13d3e18fcb"},"hitsBattlerWrapper":{"start":"0x816c298","endExclusive":"0x816c2ca","sha256":"4356d501ec4fd18926f15c3d51bd8d384c15e4a9937314aa711b5af519241129"},"fullHPProtection":{"start":"0x8171abc","endExclusive":"0x8171af6","sha256":"ff070650d9665f5d70a5ce4467fc78729ce767cb3bb32ac4808c53e121299f51"},"healthPercent":{"start":"0x816b508","endExclusive":"0x816b528","sha256":"c22df7567d6fd11e3ec63fbbe16765fa12b9d54ae2f79996e909c717c4f3802d"}},"blocks":{"scoreOutgoingCall":{"start":"0x8082030","endExclusive":"0x808206c","bytes":"002a1bd1414648194d4bc0180078002814d04c4861000919c9000918488800280cd000920192301c391c079b1a0e02abe9f04efe0399884200dd0390","sha256":"03d26217d80e2c459bbb4f5b2c787856fbbc14b02a4f5604373db7cc176210e1","instructions":[["0x8082030","002a","cmp r2, #0"],["0x8082032","1bd1","bne #0x808206c"],["0x8082034","4146","mov r1, r8"],["0x8082036","4819","adds r0, r1, r5"],["0x8082038","4d4b","ldr r3, [pc, #0x134]"],["0x808203a","c018","adds r0, r0, r3"],["0x808203c","0078","ldrb r0, [r0]"],["0x808203e","0028","cmp r0, #0"],["0x8082040","14d0","beq #0x808206c"],["0x8082042","4c48","ldr r0, [pc, #0x130]"],["0x8082044","6100","lsls r1, r4, #1"],["0x8082046","0919","adds r1, r1, r4"],["0x8082048","c900","lsls r1, r1, #3"],["0x808204a","0918","adds r1, r1, r0"],["0x808204c","4888","ldrh r0, [r1, #2]"],["0x808204e","0028","cmp r0, #0"],["0x8082050","0cd0","beq #0x808206c"],["0x8082052","0092","str r2, [sp]"],["0x8082054","0192","str r2, [sp, #4]"],["0x8082056","301c","adds r0, r6, #0"],["0x8082058","391c","adds r1, r7, #0"],["0x808205a","079b","ldr r3, [sp, #0x1c]"],["0x808205c","1a0e","lsrs r2, r3, #0x18"],["0x808205e","02ab","add r3, sp, #8"],["0x8082060","e9f04efe","bl #0x816bd00"],["0x8082064","0399","ldr r1, [sp, #0xc]"],["0x8082066","8842","cmp r0, r1"],["0x8082068","00dd","ble #0x808206c"],["0x808206a","0390","str r0, [sp, #0xc]"]]},"scoreIncomingCall":{"start":"0x80820be","endExclusive":"0x80820ee","bytes":"021c002a14d12b4861000919c9000918488800280cd000920192281c311c099b1a0e02abe9f00dfe0499884200dd0490","sha256":"b53a23b54c12c0c3507dc17ea6b5c31fbb40d266e5ff6a2bf2b2d2c24d0b1489","instructions":[["0x80820be","021c","adds r2, r0, #0"],["0x80820c0","002a","cmp r2, #0"],["0x80820c2","14d1","bne #0x80820ee"],["0x80820c4","2b48","ldr r0, [pc, #0xac]"],["0x80820c6","6100","lsls r1, r4, #1"],["0x80820c8","0919","adds r1, r1, r4"],["0x80820ca","c900","lsls r1, r1, #3"],["0x80820cc","0918","adds r1, r1, r0"],["0x80820ce","4888","ldrh r0, [r1, #2]"],["0x80820d0","0028","cmp r0, #0"],["0x80820d2","0cd0","beq #0x80820ee"],["0x80820d4","0092","str r2, [sp]"],["0x80820d6","0192","str r2, [sp, #4]"],["0x80820d8","281c","adds r0, r5, #0"],["0x80820da","311c","adds r1, r6, #0"],["0x80820dc","099b","ldr r3, [sp, #0x24]"],["0x80820de","1a0e","lsrs r2, r3, #0x18"],["0x80820e0","02ab","add r3, sp, #8"],["0x80820e2","e9f00dfe","bl #0x816bd00"],["0x80820e6","0499","ldr r1, [sp, #0x10]"],["0x80820e8","8842","cmp r0, r1"],["0x80820ea","00dd","ble #0x80820ee"],["0x80820ec","0490","str r0, [sp, #0x10]"]]},"scoreHazards":{"start":"0x80820f8","endExclusive":"0x808215c","bytes":"18490898484440014018448d5246b81840014018478d4846fff794fe241a049ba3422fdb0998040e51460806050e201c291ceff04ffc0004000c012822d1201ceff0c0fc000400281cd1201c291ceff08ffc0004002815d1059a962a12d0012464427ce0","sha256":"b167a15a5b3916485b40d2a0cc671c739fd9b0f1a95af05b64a4e3ec352cb3e3","instructions":[["0x80820f8","1849","ldr r1, [pc, #0x60]"],["0x80820fa","0898","ldr r0, [sp, #0x20]"],["0x80820fc","4844","add r0, sb"],["0x80820fe","4001","lsls r0, r0, #5"],["0x8082100","4018","adds r0, r0, r1"],["0x8082102","448d","ldrh r4, [r0, #0x2a]"],["0x8082104","5246","mov r2, sl"],["0x8082106","b818","adds r0, r7, r2"],["0x8082108","4001","lsls r0, r0, #5"],["0x808210a","4018","adds r0, r0, r1"],["0x808210c","478d","ldrh r7, [r0, #0x2a]"],["0x808210e","4846","mov r0, sb"],["0x8082110","fff794fe","bl #0x8081e3c"],["0x8082114","241a","subs r4, r4, r0"],["0x8082116","049b","ldr r3, [sp, #0x10]"],["0x8082118","a342","cmp r3, r4"],["0x808211a","2fdb","blt #0x808217c"],["0x808211c","0998","ldr r0, [sp, #0x24]"],["0x808211e","040e","lsrs r4, r0, #0x18"],["0x8082120","5146","mov r1, sl"],["0x8082122","0806","lsls r0, r1, #0x18"],["0x8082124","050e","lsrs r5, r0, #0x18"],["0x8082126","201c","adds r0, r4, #0"],["0x8082128","291c","adds r1, r5, #0"],["0x808212a","eff04ffc","bl #0x81719cc"],["0x808212e","0004","lsls r0, r0, #0x10"],["0x8082130","000c","lsrs r0, r0, #0x10"],["0x8082132","0128","cmp r0, #1"],["0x8082134","22d1","bne #0x808217c"],["0x8082136","201c","adds r0, r4, #0"],["0x8082138","eff0c0fc","bl #0x8171abc"],["0x808213c","0004","lsls r0, r0, #0x10"],["0x808213e","0028","cmp r0, #0"],["0x8082140","1cd1","bne #0x808217c"],["0x8082142","201c","adds r0, r4, #0"],["0x8082144","291c","adds r1, r5, #0"],["0x8082146","eff08ffc","bl #0x8171a68"],["0x808214a","0004","lsls r0, r0, #0x10"],["0x808214c","0028","cmp r0, #0"],["0x808214e","15d1","bne #0x808217c"],["0x8082150","059a","ldr r2, [sp, #0x14]"],["0x8082152","962a","cmp r2, #0x96"],["0x8082154","12d0","beq #0x808217c"],["0x8082156","0124","movs r4, #1"],["0x8082158","6442","rsbs r4, r4, #0"],["0x808215a","7ce0","b #0x8082256"]]},"scoreHitComparison":{"start":"0x80821cc","endExclusive":"0x808223e","bytes":"03985146eaf062f8041c04984946eaf05df8844209d8099a100e53461906090eeff0eefb0004002802d03088842801d103242ae003985146eaf048f8041c04984946eaf043f884420ad20999080e52461106090eeff0d4fb0004000c012806d03688b4204000864201d0ca2e01d102240be0","sha256":"e2d75df0739e5d8c734b592e96c69d9c7feaff254ff964596e978c6f8e39a992","instructions":[["0x80821cc","0398","ldr r0, [sp, #0xc]"],["0x80821ce","5146","mov r1, sl"],["0x80821d0","eaf062f8","bl #0x816c298"],["0x80821d4","041c","adds r4, r0, #0"],["0x80821d6","0498","ldr r0, [sp, #0x10]"],["0x80821d8","4946","mov r1, sb"],["0x80821da","eaf05df8","bl #0x816c298"],["0x80821de","8442","cmp r4, r0"],["0x80821e0","09d8","bhi #0x80821f6"],["0x80821e2","099a","ldr r2, [sp, #0x24]"],["0x80821e4","100e","lsrs r0, r2, #0x18"],["0x80821e6","5346","mov r3, sl"],["0x80821e8","1906","lsls r1, r3, #0x18"],["0x80821ea","090e","lsrs r1, r1, #0x18"],["0x80821ec","eff0eefb","bl #0x81719cc"],["0x80821f0","0004","lsls r0, r0, #0x10"],["0x80821f2","0028","cmp r0, #0"],["0x80821f4","02d0","beq #0x80821fc"],["0x80821f6","3088","ldrh r0, [r6]"],["0x80821f8","8428","cmp r0, #0x84"],["0x80821fa","01d1","bne #0x8082200"],["0x80821fc","0324","movs r4, #3"],["0x80821fe","2ae0","b #0x8082256"],["0x8082200","0398","ldr r0, [sp, #0xc]"],["0x8082202","5146","mov r1, sl"],["0x8082204","eaf048f8","bl #0x816c298"],["0x8082208","041c","adds r4, r0, #0"],["0x808220a","0498","ldr r0, [sp, #0x10]"],["0x808220c","4946","mov r1, sb"],["0x808220e","eaf043f8","bl #0x816c298"],["0x8082212","8442","cmp r4, r0"],["0x8082214","0ad2","bhs #0x808222c"],["0x8082216","0999","ldr r1, [sp, #0x24]"],["0x8082218","080e","lsrs r0, r1, #0x18"],["0x808221a","5246","mov r2, sl"],["0x808221c","1106","lsls r1, r2, #0x18"],["0x808221e","090e","lsrs r1, r1, #0x18"],["0x8082220","eff0d4fb","bl #0x81719cc"],["0x8082224","0004","lsls r0, r0, #0x10"],["0x8082226","000c","lsrs r0, r0, #0x10"],["0x8082228","0128","cmp r0, #1"],["0x808222a","06d0","beq #0x808223a"],["0x808222c","3688","ldrh r6, [r6]"],["0x808222e","b420","movs r0, #0xb4"],["0x8082230","4000","lsls r0, r0, #1"],["0x8082232","8642","cmp r6, r0"],["0x8082234","01d0","beq #0x808223a"],["0x8082236","ca2e","cmp r6, #0xca"],["0x8082238","01d1","bne #0x808223e"],["0x808223a","0224","movs r4, #2"],["0x808223c","0be0","b #0x8082256"]]},"aiDamageArguments":{"start":"0x816bd00","endExclusive":"0x816bd36","bytes":"f0b557464e464546e0b48db00593159b0004060c09060f0e1206120e92461d48006840690690002b13d0381c311ceff60dfa00280dd0","sha256":"e8e8d9dbc97e18d6a6786f9a4ea8ac000c9c31c8ff3c0413df28112bad6d13e3","instructions":[["0x816bd00","f0b5","push {r4, r5, r6, r7, lr}"],["0x816bd02","5746","mov r7, sl"],["0x816bd04","4e46","mov r6, sb"],["0x816bd06","4546","mov r5, r8"],["0x816bd08","e0b4","push {r5, r6, r7}"],["0x816bd0a","8db0","sub sp, #0x34"],["0x816bd0c","0593","str r3, [sp, #0x14]"],["0x816bd0e","159b","ldr r3, [sp, #0x54]"],["0x816bd10","0004","lsls r0, r0, #0x10"],["0x816bd12","060c","lsrs r6, r0, #0x10"],["0x816bd14","0906","lsls r1, r1, #0x18"],["0x816bd16","0f0e","lsrs r7, r1, #0x18"],["0x816bd18","1206","lsls r2, r2, #0x18"],["0x816bd1a","120e","lsrs r2, r2, #0x18"],["0x816bd1c","9246","mov sl, r2"],["0x816bd1e","1d48","ldr r0, [pc, #0x74]"],["0x816bd20","0068","ldr r0, [r0]"],["0x816bd22","4069","ldr r0, [r0, #0x14]"],["0x816bd24","0690","str r0, [sp, #0x18]"],["0x816bd26","002b","cmp r3, #0"],["0x816bd28","13d0","beq #0x816bd52"],["0x816bd2a","381c","adds r0, r7, #0"],["0x816bd2c","311c","adds r1, r6, #0"],["0x816bd2e","eff60dfa","bl #0x805b14c"],["0x816bd32","0028","cmp r0, #0"],["0x816bd34","0dd0","beq #0x816bd52"]]},"randomFlagForward":{"start":"0x816bf5c","endExclusive":"0x816bf7c","bytes":"43461c06230e0020009004a90191169a0292301c391c5246ecf6d8f8051ca046","sha256":"38e5256b0d2b39977cb2206278876240600e1d88c7fdec90cbc3409607a43e20","instructions":[["0x816bf5c","4346","mov r3, r8"],["0x816bf5e","1c06","lsls r4, r3, #0x18"],["0x816bf60","230e","lsrs r3, r4, #0x18"],["0x816bf62","0020","movs r0, #0"],["0x816bf64","0090","str r0, [sp]"],["0x816bf66","04a9","add r1, sp, #0x10"],["0x816bf68","0191","str r1, [sp, #4]"],["0x816bf6a","169a","ldr r2, [sp, #0x58]"],["0x816bf6c","0292","str r2, [sp, #8]"],["0x816bf6e","301c","adds r0, r6, #0"],["0x816bf70","391c","adds r1, r7, #0"],["0x816bf72","5246","mov r2, sl"],["0x816bf74","ecf6d8f8","bl #0x8058128"],["0x816bf78","051c","adds r5, r0, #0"],["0x816bf7a","a046","mov r8, r4"]]},"damageWrapper":{"start":"0x8058128","endExclusive":"0x805818c","bytes":"f0b54f464646c0b485b0051c0e1c904699460d9f2d042d0c3606360e40460006000e804649460906090e894600240094281c321c434600f07bf938600c99009101940e99029103940490281c311c42464b46fff755fc05b018bc9846a146f0bc02bc0847","sha256":"9c4cca5a1c421cfe53fcf1e14c6dfcdaa9904bfc0aef1dd1a6af1d186d6659af","instructions":[["0x8058128","f0b5","push {r4, r5, r6, r7, lr}"],["0x805812a","4f46","mov r7, sb"],["0x805812c","4646","mov r6, r8"],["0x805812e","c0b4","push {r6, r7}"],["0x8058130","85b0","sub sp, #0x14"],["0x8058132","051c","adds r5, r0, #0"],["0x8058134","0e1c","adds r6, r1, #0"],["0x8058136","9046","mov r8, r2"],["0x8058138","9946","mov sb, r3"],["0x805813a","0d9f","ldr r7, [sp, #0x34]"],["0x805813c","2d04","lsls r5, r5, #0x10"],["0x805813e","2d0c","lsrs r5, r5, #0x10"],["0x8058140","3606","lsls r6, r6, #0x18"],["0x8058142","360e","lsrs r6, r6, #0x18"],["0x8058144","4046","mov r0, r8"],["0x8058146","0006","lsls r0, r0, #0x18"],["0x8058148","000e","lsrs r0, r0, #0x18"],["0x805814a","8046","mov r8, r0"],["0x805814c","4946","mov r1, sb"],["0x805814e","0906","lsls r1, r1, #0x18"],["0x8058150","090e","lsrs r1, r1, #0x18"],["0x8058152","8946","mov sb, r1"],["0x8058154","0024","movs r4, #0"],["0x8058156","0094","str r4, [sp]"],["0x8058158","281c","adds r0, r5, #0"],["0x805815a","321c","adds r2, r6, #0"],["0x805815c","4346","mov r3, r8"],["0x805815e","00f07bf9","bl #0x8058458"],["0x8058162","3860","str r0, [r7]"],["0x8058164","0c99","ldr r1, [sp, #0x30]"],["0x8058166","0091","str r1, [sp]"],["0x8058168","0194","str r4, [sp, #4]"],["0x805816a","0e99","ldr r1, [sp, #0x38]"],["0x805816c","0291","str r1, [sp, #8]"],["0x805816e","0394","str r4, [sp, #0xc]"],["0x8058170","0490","str r0, [sp, #0x10]"],["0x8058172","281c","adds r0, r5, #0"],["0x8058174","311c","adds r1, r6, #0"],["0x8058176","4246","mov r2, r8"],["0x8058178","4b46","mov r3, sb"],["0x805817a","fff755fc","bl #0x8057a28"],["0x805817e","05b0","add sp, #0x14"],["0x8058180","18bc","pop {r3, r4}"],["0x8058182","9846","mov r8, r3"],["0x8058184","a146","mov sb, r4"],["0x8058186","f0bc","pop {r4, r5, r6, r7}"],["0x8058188","02bc","pop {r1}"],["0x805818a","0847","bx r1"]]},"damageCoreStack":{"start":"0x8057a28","endExclusive":"0x8057a66","bytes":"f0b557464e464546e0b48bb08246039104920593139c0806000e0121fcf78af9069004990806000e0121fcf783f907900398f7f751fd0890179a002a01d1","sha256":"45cec0c5f4c7abc6ba2127161402229c38bf65b4a9f7230d223e9b3a721a9ea4","instructions":[["0x8057a28","f0b5","push {r4, r5, r6, r7, lr}"],["0x8057a2a","5746","mov r7, sl"],["0x8057a2c","4e46","mov r6, sb"],["0x8057a2e","4546","mov r5, r8"],["0x8057a30","e0b4","push {r5, r6, r7}"],["0x8057a32","8bb0","sub sp, #0x2c"],["0x8057a34","8246","mov sl, r0"],["0x8057a36","0391","str r1, [sp, #0xc]"],["0x8057a38","0492","str r2, [sp, #0x10]"],["0x8057a3a","0593","str r3, [sp, #0x14]"],["0x8057a3c","139c","ldr r4, [sp, #0x4c]"],["0x8057a3e","0806","lsls r0, r1, #0x18"],["0x8057a40","000e","lsrs r0, r0, #0x18"],["0x8057a42","0121","movs r1, #1"],["0x8057a44","fcf78af9","bl #0x8053d5c"],["0x8057a48","0690","str r0, [sp, #0x18]"],["0x8057a4a","0499","ldr r1, [sp, #0x10]"],["0x8057a4c","0806","lsls r0, r1, #0x18"],["0x8057a4e","000e","lsrs r0, r0, #0x18"],["0x8057a50","0121","movs r1, #1"],["0x8057a52","fcf783f9","bl #0x8053d5c"],["0x8057a56","0790","str r0, [sp, #0x1c]"],["0x8057a58","0398","ldr r0, [sp, #0xc]"],["0x8057a5a","f7f751fd","bl #0x804f500"],["0x8057a5e","0890","str r0, [sp, #0x20]"],["0x8057a60","179a","ldr r2, [sp, #0x5c]"],["0x8057a62","002a","cmp r2, #0"],["0x8057a64","01d1","bne #0x8057a6a"]]},"randomRollGate":{"start":"0x8057c82","endExclusive":"0x8057ca2","bytes":"159800280cd0052000210f2237f0d5fe6421091a4d43281c642110f3ccfc051c","sha256":"22397b0a0f3189886cfc0a8a745d25d5e840f860eb471f5f9f5a3be7498c12fb","instructions":[["0x8057c82","1598","ldr r0, [sp, #0x54]"],["0x8057c84","0028","cmp r0, #0"],["0x8057c86","0cd0","beq #0x8057ca2"],["0x8057c88","0520","movs r0, #5"],["0x8057c8a","0021","movs r1, #0"],["0x8057c8c","0f22","movs r2, #0xf"],["0x8057c8e","37f0d5fe","bl #0x808fa3c"],["0x8057c92","6421","movs r1, #0x64"],["0x8057c94","091a","subs r1, r1, r0"],["0x8057c96","4d43","muls r5, r1, r5"],["0x8057c98","281c","adds r0, r5, #0"],["0x8057c9a","6421","movs r1, #0x64"],["0x8057c9c","10f3ccfc","bl #0x8368638"],["0x8057ca0","051c","adds r5, r0, #0"]]},"criticalRandomRollGate":{"start":"0x805806a","endExclusive":"0x805808a","bytes":"159b002b0cd0052000210f2237f0e1fc6421091a4c43201c642110f3d8fa041c","sha256":"d8abf191333c955e961b6cb7e4a5ba33bdd13437400f3112265ecace7da81c6e","instructions":[["0x805806a","159b","ldr r3, [sp, #0x54]"],["0x805806c","002b","cmp r3, #0"],["0x805806e","0cd0","beq #0x805808a"],["0x8058070","0520","movs r0, #5"],["0x8058072","0021","movs r1, #0"],["0x8058074","0f22","movs r2, #0xf"],["0x8058076","37f0e1fc","bl #0x808fa3c"],["0x805807a","6421","movs r1, #0x64"],["0x805807c","091a","subs r1, r1, r0"],["0x805807e","4c43","muls r4, r1, r4"],["0x8058080","201c","adds r0, r4, #0"],["0x8058082","6421","movs r1, #0x64"],["0x8058084","10f3d8fa","bl #0x8368638"],["0x8058088","041c","adds r4, r0, #0"]]},"hitsCeiling":{"start":"0x816c27c","endExclusive":"0x816c298","bytes":"00b5021c002a05d088180138111cfcf1e9fc01e00120404202bc0847","sha256":"86f8051f39b1178f828096e0209cb7a0ef769999163ce14b5ada9f13d3e18fcb","instructions":[["0x816c27c","00b5","push {lr}"],["0x816c27e","021c","adds r2, r0, #0"],["0x816c280","002a","cmp r2, #0"],["0x816c282","05d0","beq #0x816c290"],["0x816c284","8818","adds r0, r1, r2"],["0x816c286","0138","subs r0, #1"],["0x816c288","111c","adds r1, r2, #0"],["0x816c28a","fcf1e9fc","bl #0x8368c60"],["0x816c28e","01e0","b #0x816c294"],["0x816c290","0120","movs r0, #1"],["0x816c292","4042","rsbs r0, r0, #0"],["0x816c294","02bc","pop {r1}"],["0x816c296","0847","bx r1"]]},"hitsBattlerWrapper":{"start":"0x816c298","endExclusive":"0x816c2ca","bytes":"30b50c1c0b4a6100091949018918498dfff7e8ff051c012d07d12006000e05f001fc0004002800d00225281c30bc02bc0847","sha256":"4356d501ec4fd18926f15c3d51bd8d384c15e4a9937314aa711b5af519241129","instructions":[["0x816c298","30b5","push {r4, r5, lr}"],["0x816c29a","0c1c","adds r4, r1, #0"],["0x816c29c","0b4a","ldr r2, [pc, #0x2c]"],["0x816c29e","6100","lsls r1, r4, #1"],["0x816c2a0","0919","adds r1, r1, r4"],["0x816c2a2","4901","lsls r1, r1, #5"],["0x816c2a4","8918","adds r1, r1, r2"],["0x816c2a6","498d","ldrh r1, [r1, #0x2a]"],["0x816c2a8","fff7e8ff","bl #0x816c27c"],["0x816c2ac","051c","adds r5, r0, #0"],["0x816c2ae","012d","cmp r5, #1"],["0x816c2b0","07d1","bne #0x816c2c2"],["0x816c2b2","2006","lsls r0, r4, #0x18"],["0x816c2b4","000e","lsrs r0, r0, #0x18"],["0x816c2b6","05f001fc","bl #0x8171abc"],["0x816c2ba","0004","lsls r0, r0, #0x10"],["0x816c2bc","0028","cmp r0, #0"],["0x816c2be","00d0","beq #0x816c2c2"],["0x816c2c0","0225","movs r5, #2"],["0x816c2c2","281c","adds r0, r5, #0"],["0x816c2c4","30bc","pop {r4, r5}"],["0x816c2c6","02bc","pop {r1}"],["0x816c2c8","0847","bx r1"]]},"fullHPProtection":{"start":"0x8171abc","endExclusive":"0x8171af6","bytes":"10b50006000e031c00240c48006842695900101c103040180088552803d050180088052805d1181cf9f710fd642800d10124201c10bc02bc0847","sha256":"ff070650d9665f5d70a5ce4467fc78729ce767cb3bb32ac4808c53e121299f51","instructions":[["0x8171abc","10b5","push {r4, lr}"],["0x8171abe","0006","lsls r0, r0, #0x18"],["0x8171ac0","000e","lsrs r0, r0, #0x18"],["0x8171ac2","031c","adds r3, r0, #0"],["0x8171ac4","0024","movs r4, #0"],["0x8171ac6","0c48","ldr r0, [pc, #0x30]"],["0x8171ac8","0068","ldr r0, [r0]"],["0x8171aca","4269","ldr r2, [r0, #0x14]"],["0x8171acc","5900","lsls r1, r3, #1"],["0x8171ace","101c","adds r0, r2, #0"],["0x8171ad0","1030","adds r0, #0x10"],["0x8171ad2","4018","adds r0, r0, r1"],["0x8171ad4","0088","ldrh r0, [r0]"],["0x8171ad6","5528","cmp r0, #0x55"],["0x8171ad8","03d0","beq #0x8171ae2"],["0x8171ada","5018","adds r0, r2, r1"],["0x8171adc","0088","ldrh r0, [r0]"],["0x8171ade","0528","cmp r0, #5"],["0x8171ae0","05d1","bne #0x8171aee"],["0x8171ae2","181c","adds r0, r3, #0"],["0x8171ae4","f9f710fd","bl #0x816b508"],["0x8171ae8","6428","cmp r0, #0x64"],["0x8171aea","00d1","bne #0x8171aee"],["0x8171aec","0124","movs r4, #1"],["0x8171aee","201c","adds r0, r4, #0"],["0x8171af0","10bc","pop {r4}"],["0x8171af2","02bc","pop {r1}"],["0x8171af4","0847","bx r1"]]},"healthPercent":{"start":"0x816b508","endExclusive":"0x816b528","bytes":"00b50006000e064a41000918490189184a8d64205043c98dfdf18af802bc0847","sha256":"c22df7567d6fd11e3ec63fbbe16765fa12b9d54ae2f79996e909c717c4f3802d","instructions":[["0x816b508","00b5","push {lr}"],["0x816b50a","0006","lsls r0, r0, #0x18"],["0x816b50c","000e","lsrs r0, r0, #0x18"],["0x816b50e","064a","ldr r2, [pc, #0x18]"],["0x816b510","4100","lsls r1, r0, #1"],["0x816b512","0918","adds r1, r1, r0"],["0x816b514","4901","lsls r1, r1, #5"],["0x816b516","8918","adds r1, r1, r2"],["0x816b518","4a8d","ldrh r2, [r1, #0x2a]"],["0x816b51a","6420","movs r0, #0x64"],["0x816b51c","5043","muls r0, r2, r0"],["0x816b51e","c98d","ldrh r1, [r1, #0x2e]"],["0x816b520","fdf18af8","bl #0x8368638"],["0x816b524","02bc","pop {r1}"],["0x816b526","0847","bx r1"]]}}}''')


def hexaddr(value):
    return f'0x{value:08x}'


def sha256(value):
    return hashlib.sha256(value).hexdigest()


def bytes_at(data, address, count):
    offset = address - ROM_BASE
    if offset < 0 or offset + count > len(data):
        raise ValueError('ROM address outside the file: ' + hexaddr(address))
    return data[offset:offset + count]


def halfword(data, address):
    return struct.unpack('<H', bytes_at(data, address, 2))[0]


def decode_thumb_bl(data, address):
    first, second = struct.unpack('<HH', bytes_at(data, address, 4))
    if first & 0xf800 != 0xf000 or second & 0xf800 != 0xf800:
        raise ValueError('Expected ARM7TDMI Thumb BL at ' + hexaddr(address))
    relative = ((first & 0x7ff) << 12) | ((second & 0x7ff) << 1)
    if relative & 0x400000:
        relative -= 0x800000
    return address + 4 + relative


def decode_thumb_branch(data, address):
    instruction = halfword(data, address)
    if instruction & 0xf000 == 0xd000 and ((instruction >> 8) & 15) < 14:
        relative = instruction & 255
        if relative & 128:
            relative -= 256
        conditions = ['beq', 'bne', 'bhs', 'blo', 'bmi', 'bpl', 'bvs', 'bvc', 'bhi', 'bls', 'bge', 'blt', 'bgt', 'ble']
        return conditions[(instruction >> 8) & 15], address + 4 + relative * 2
    if instruction & 0xf800 == 0xe000:
        relative = instruction & 0x7ff
        if relative & 0x400:
            relative -= 0x800
        return 'b', address + 4 + relative * 2
    return None


def decode_literal(data, address):
    instruction = halfword(data, address)
    if instruction & 0xf800 != 0x4800:
        raise ValueError('Expected Thumb PC-relative literal load at ' + hexaddr(address))
    pool = ((address + 4) & ~3) + (instruction & 255) * 4
    return pool, struct.unpack('<I', bytes_at(data, pool, 4))[0]


def encoded_name(text):
    return bytes(0 if c == ' ' else 0xbb + ord(c) - 65 if 'A' <= c <= 'Z'
                 else 0xd5 + ord(c) - 97 for c in text) + b'\xff'


def replay_hits_helper(data, damage, hp, start=0x0816c27c, division=0x08368c60):
    """Bounded replay of the 28-byte verified helper, not an emulator of the game.

    Handles only the exact Thumb instructions in that helper. The sole BL is
    intercepted as unsigned integer division after independently checking its
    target. Stack save/restore have no effect on the returned arithmetic value.
    """
    registers = [damage & 0xffffffff, hp & 0xffffffff, 0]
    pc, zero, steps = start, False, 0
    while steps < 30:
        steps += 1
        instruction = halfword(data, pc)
        if instruction == 0xb500:  # push {lr}
            pass
        elif instruction == 0x1c02:  # r2 <- r0
            registers[2] = registers[0]
        elif instruction == 0x2a00:  # cmp r2, 0
            zero = registers[2] == 0
        elif instruction == 0xd005:  # beq zero-damage branch
            if zero:
                pc = decode_thumb_branch(data, pc)[1]
                continue
        elif instruction == 0x1888:
            registers[0] = (registers[1] + registers[2]) & 0xffffffff
        elif instruction == 0x3801:
            registers[0] = (registers[0] - 1) & 0xffffffff
        elif instruction == 0x1c11:
            registers[1] = registers[2]
        elif instruction & 0xf800 == 0xf000:
            if decode_thumb_bl(data, pc) != division or registers[1] == 0:
                raise ValueError('Unexpected division call in hits helper')
            registers[0] //= registers[1]
            pc += 4
            continue
        elif instruction == 0xe001:
            pc = decode_thumb_branch(data, pc)[1]
            continue
        elif instruction == 0x2001:
            registers[0] = 1
        elif instruction == 0x4240:
            registers[0] = (-registers[0]) & 0xffffffff
        elif instruction == 0xbc02:  # pop return address
            pass
        elif instruction == 0x4708:  # bx return address
            return registers[0]
        else:
            raise ValueError('Unsupported instruction in bounded helper replay: ' + hexaddr(pc))
        pc += 2
    raise ValueError('Hits helper replay exceeded its fixed instruction bound')


def audit(data):
    checks, ranges, blocks, calls, branches = [], [], [], [], []

    def check(identity, passed, detail):
        if not passed:
            raise ValueError(identity + ': ' + detail)
        checks.append({'id': identity, 'passed': True, 'detail': detail})

    digest = sha256(data)
    fixture_file = ROOT / 'tests/fixtures/native-1.2.6-helpers.json'
    current = json.loads(fixture_file.read_text(encoding='utf8'))
    if digest == ROM_SHA256:
        evidence, version = EXPECTED, '1.2.4'
        parameters = {'hitsHelper': 0x0816c27c, 'divisionHelper': 0x08368c60,
                      'battleMonsLiterals': [0x0816c29c, 0x0816b50e],
                      'itemTable': 0x8858a4, 'abilityNames': 0x3d287b}
    elif digest == current['romSHA256']:
        evidence, version, parameters = current, current['version'], current['parameters']
    else:
        raise ValueError('Unsupported ROM fingerprint; neither pinned1.2.4 nor1.2.6')
    check('rom-sha256', digest in [ROM_SHA256, current['romSHA256']], 'Exact supplied Null ' + version + ' image fingerprint')
    check('rom-size', len(data) == 33554432, '32 MiB image')
    for name, expected in evidence['ranges'].items():
        start, end = int(expected['start'], 16), int(expected['endExclusive'], 16)
        actual = bytes_at(data, start, end - start)
        check('range-' + name, sha256(actual) == expected['sha256'], 'Whole pinned code range, including any embedded literal pools')
        ranges.append({'name': name, 'start': hexaddr(start), 'endExclusive': hexaddr(end), 'lengthBytes': end - start, 'sha256': sha256(actual)})
    for name, expected in evidence['blocks'].items():
        start, end = int(expected['start'], 16), int(expected['endExclusive'], 16)
        actual = bytes_at(data, start, end - start)
        check('block-' + name, actual.hex() == expected['bytes'], 'Exact critical instruction bytes')
        cursor, instructions = start, []
        for address, raw, assembly in expected['instructions']:
            address, code = int(address, 16), bytes.fromhex(raw)
            check('instruction-' + hexaddr(address), address == cursor and bytes_at(data, address, len(code)) == code, 'Recorded disassembly row matches exact ROM bytes')
            cursor += len(code)
            instructions.append({'address': hexaddr(address), 'bytes': raw, 'assembly': assembly})
            if assembly.startswith('bl '):
                target = decode_thumb_bl(data, address)
                check('bl-' + hexaddr(address), target == int(assembly.split('#')[1], 16), 'Independently decoded Thumb BL target')
                calls.append({'from': hexaddr(address), 'to': hexaddr(target)})
            else:
                decoded = decode_thumb_branch(data, address)
                if decoded:
                    check('branch-' + hexaddr(address), assembly == decoded[0] + ' #' + hex(decoded[1]), 'Independently decoded Thumb branch condition and target')
                    branches.append({'address': hexaddr(address), 'condition': decoded[0], 'target': hexaddr(decoded[1])})
        check('block-coverage-' + name, cursor == end, 'Disassembly rows cover every byte in this critical block')
        blocks.append({'name': name, 'start': hexaddr(start), 'endExclusive': hexaddr(end), 'bytes': actual.hex(), 'sha256': sha256(actual), 'instructions': instructions})

    literals = []
    for address in parameters['battleMonsLiterals']:
        value = 0x02004d58
        pool, actual = decode_literal(data, address)
        check('battle-mons-literal-' + hexaddr(address), actual == value, 'gBattleMons base used by HP helpers')
        literals.append({'instruction': hexaddr(address), 'poolAddress': hexaddr(pool), 'value': hexaddr(actual)})

    # Read the native item record itself, instead of borrowing a modern enum.
    item_base, stride = parameters['itemTable'], 44
    matches = []
    needle = encoded_name('Focus Sash')
    for index in range(2000):
        position = item_base + index * stride
        record = data[position:position + stride]
        if record.startswith(needle):
            matches.append((position, index, record))
    check('focus-sash-unique-item-record', len(matches) == 1, 'One aligned Focus Sash name in the native 44-byte item table')
    position, index, record = matches[0]
    check('focus-sash-native-id', struct.unpack_from('<H', record, 20)[0] == index, 'Item record index equals its stored native ID')
    check('focus-sash-hold-effect', record[24] == 0x55, 'Native Focus Sash item record uses hold effect 0x55 tested by the helper')
    protection_item = {'name': 'Focus Sash', 'nativeItemId': index, 'romOffset': hex(position), 'recordSHA256': sha256(record), 'holdEffect': hex(record[24])}
    ability_base, ability_stride = parameters['abilityNames'], 17
    names = ['Stench', 'Drizzle', 'Speed Boost', 'Battle Armor', 'Sturdy', 'Damp']
    for index, name in enumerate(names, 1):
        check('ability-name-' + str(index), data[ability_base + index * ability_stride:].startswith(encoded_name(name)), 'Native ability name table entry ' + str(index) + ' is ' + name)

    # Check the replay against mathematical ceilings on realistic HP/damage
    # bounds. This executes only the recognized arithmetic block above.
    pairs = [(damage, hp) for damage in [0, 1, 2, 3, 37, 44, 45, 49, 50, 100, 109, 65535]
             for hp in [0, 1, 2, 45, 89, 90, 100, 103, 65535]]
    for damage, hp in pairs:
        result = replay_hits_helper(data, damage, hp, parameters['hitsHelper'], parameters['divisionHelper'])
        expected = (hp + damage - 1) // damage if damage else 0xffffffff
        check('hits-replay-' + str(damage) + '-' + str(hp), result == expected, 'Bounded Thumb instruction replay agrees with unsigned ceiling/sentinel')

    result = {
        'schemaVersion': 1, 'audit': 'native-threshold-rom', 'status': 'verified', 'errors': [],
        'checkedAtUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'romSHA256': digest, 'romVersion': version, 'romSizeBytes': len(data),
        'auditScriptSHA256': sha256(pathlib.Path(__file__).read_bytes()),
        'method': 'Exact read-only ROM hash; pinned code-range hashes and critical instruction bytes; recorded Thumb disassembly; standard-library BL/branch/literal decoding; bounded arithmetic-helper instruction replay.',
        'disassembly': {'recordedWith': 'Capstone ' + evidence['capstoneVersion'], 'runtimeDependency': None,
                        'note': 'Assembly annotations were recorded during development; each rerun validates their exact instruction bytes and independently decodes branches/BL/literals, rather than running a full disassembler.'},
        'functionNamesAreInferred': True, 'codeRanges': ranges, 'criticalBlocks': blocks,
        'decodedCalls': calls, 'decodedBranches': branches, 'decodedLiterals': literals,
        'nativeLabels': {'focusSashItem': protection_item, 'sturdyAbilityId': 5,
                         'abilityNameTableRomOffset': hex(ability_base), 'abilityNameStride': ability_stride},
        'checks': checks,
        'observations': {
            'replacementDamageCalls': ['0x08082060', '0x080820e2'], 'replacementCallTarget': '0x0816bd00',
            'replacementStackArguments': [0, 0],
            'lastArgumentMeaning': 'Controls optional random 85-100 percent damage reduction in the traced ordinary path; replacement calls pass zero and skip that gate.',
            'flagChain': ['AI_CalcDamage entry stack growth 0x54: arg6 is [sp+0x58]',
                          '0x0816bf6a -> outgoing [sp+8] -> BL 0x08058128',
                          '0x0805816a reads caller arg7 at [sp+0x38], writes outgoing [sp+8]',
                          '0x0805817a -> 0x08057a28, stack growth 0x4c: arg7 is [sp+0x54]',
                          '0x08057c82 checks that flag; zero branches to 0x08057ca2 over the random multiplier'],
            'randomBranch': {'gate': '0x08057c82', 'zeroFlagSkipsTo': '0x08057ca2', 'rngCall': '0x08057c8e',
                             'rngHelper': '0x0808fa3c', 'rngCallBounds': [0, 15], 'positiveFlagArithmetic': 'damage * (100 - bounded_rng_result) / 100 with integer truncation'},
            'similarConditionalBlock': {'gate': '0x0805806a', 'zeroFlagSkipsTo': '0x0805808a',
                                       'note': 'A similar random-factor gate exists in another special damage path; its full reachability is outside this focused audit.'},
            'hits': {'helper': '0x0816c27c', 'formula': '(hp + damage - 1) / damage, unsigned integer division',
                     'zeroDamageSentinel': '0xffffffff', 'wrapper': '0x0816c298', 'hpBase': '0x02004d58',
                     'battlerStride': '0x60', 'hpOffset': '0x2a', 'protectionHelper': '0x08171abc',
                     'protection': 'Wrapper changes one hit to two when native hold effect 0x55 (Focus Sash) or ability 5 (Sturdy) is active at 100 HP percent.',
                     'boundedInstructionReplayCases': len(pairs)},
            'hazards': 'The early slow-candidate KO check subtracts hazards at 0x08082110-0x08082114. Later hits comparisons call the wrapper reading raw current HP; these are distinct native branches.',
        },
        'limitations': [
            'This verifies the listed ROM bytes and local control flow, not full-game emulation or global native AI parity.',
            'Function names are analytical labels inferred by matching the supplied C/control flow; the ROM is not a symbolic source release.',
            'Skipping the random factor supports maximum-roll replacement estimates for traced ordinary damage; it does not certify all JavaScript damage formulas, rounding, dynamic/multi-hit moves, critical paths, items or forms.',
            'The RNG helper distribution and cross-check correlations are not certified by passing the bounds 0 and 15.',
            'Only selected instructions in the hits arithmetic helper are replayed; battle state, hazards and survival wrappers are not emulated end to end.',
            'No ROM, save file or emulator state is included in the calculator archive. The report contains only focused audit evidence.',
        ],
        'nativeParityCertified': False,
    }
    if version == '1.2.6':
        result['observations'] = evidence['observations']
        result['evidenceFixture'] = 'tests/fixtures/native-1.2.6-helpers.json'
        result['evidenceFixtureSHA256'] = sha256(fixture_file.read_bytes())
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rom', type=pathlib.Path, help='Read-only ROM path; alternatively set NULL_AI_ROM.')
    parser.add_argument('--output', type=pathlib.Path, default=ROOT / 'verification/native-threshold-rom.json', help='Output JSON report path.')
    args = parser.parse_args()
    rom = args.rom or (pathlib.Path(os.environ['NULL_AI_ROM']) if os.environ.get('NULL_AI_ROM') else None)
    if rom is None:
        parser.error('Provide --rom PATH or NULL_AI_ROM. The ROM is not distributed with the calculator.')
    try:
        if args.output.resolve() == rom.resolve():
            raise ValueError('The output report must not overwrite the read-only ROM.')
        report = audit(rom.read_bytes())
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        print(json.dumps({'status': report['status'], 'romSHA256': report['romSHA256'], 'checks': len(report['checks']),
                          'codeRanges': len(report['codeRanges']), 'criticalBlocks': len(report['criticalBlocks']),
                          'nativeParityCertified': False}))
    except (OSError, ValueError) as error:
        print(json.dumps({'status': 'failed', 'errors': [str(error)], 'nativeParityCertified': False}), file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
