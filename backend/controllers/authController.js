const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const jwt = require('jsonwebtoken'); 
const bcrypt = require('bcrypt'); // Puluwannam bcryptjs use karanna
const { getAvatarForPhone } = require('../utils/avatarUtils');

// NIC Validation Logic
const isValidNIC = (nic) => {
  if (!nic) return true; 
  const numbersOnly = nic.replace(/[vVxX]/g, '');
  const isAllSame = numbersOnly.split('').every(char => char === numbersOnly[0]);
  if (isAllSame) return false;
  const oldNicPattern = /^[0-9]{9}[vVxX]$/;
  const newNicPattern = /^[0-9]{12}$/;
  return oldNicPattern.test(nic) || newNicPattern.test(nic);
};

const normalizePhone = (p) => {
  if (!p) return p;
  let num = String(p).replace(/[\s-]/g, '');
  if (num.startsWith('+94')) {
    num = '0' + num.slice(3);
  } else if (num.startsWith('94') && num.length === 11) {
    num = '0' + num.slice(2);
  }
  return num;
};

// ================= REGISTER LOGIC =================
exports.registerStudent = async (req, res) => {
  try {
    let { 
      firstName, lastName, phone, whatsapp, optionalPhone, 
      nic, addressHouseNo, addressStreet, city, district, 
      password, confirmPassword 
    } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match!" });
    }

    if (nic && !isValidNIC(nic)) {
      return res.status(400).json({ error: "Invalid NIC format. Please enter a valid ID number." });
    }
    
    phone = normalizePhone(phone);
    whatsapp = normalizePhone(whatsapp);
    optionalPhone = normalizePhone(optionalPhone);

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return res.status(400).json({ error: "Phone number is already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 🎨 Assign the EXACT avatar allocated to this WhatsApp number automatically until student uploads a custom photo
    const { dpCode, imagePath } = getAvatarForPhone(phone || whatsapp);

    const newUser = await prisma.user.create({
      data: {
        firstName, lastName, phone, whatsapp, optionalPhone,
        nic, addressHouseNo, addressStreet, city, district,
        password: hashedPassword,
        role: "STUDENT",
        image: imagePath,
        appChatDp: dpCode
      }
    });

    res.status(201).json({ message: "Student registered successfully!", userId: newUser.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error during registration." });
  }
};

// ================= LOGIN LOGIC =================
exports.loginUser = async (req, res) => {
  try {
    let { phone, password } = req.body;
    const rawPhone = String(phone || '').trim();
    const normalized = normalizePhone(rawPhone);

    let user = await prisma.user.findFirst({ 
      where: { 
        OR: [
          { phone: normalized },
          { phone: rawPhone },
          { phone: { startsWith: normalized } }
        ]
      } 
    });

    if (!user) return res.status(404).json({ error: "User not found!" });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: "Invalid credentials!" });

    // Single session: ONLY rotate session_id for student accounts. Staff can maintain multi-device logins.
    const roleUpper = String(user.role || '').trim().toUpperCase();
    const isExplicitStaff = [
        'ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'STAFF', 'COORDINATOR', 
        'CALLER', 'MANAGER', 'MANAGEMENT', 'TEACHER', 'INSTRUCTOR', 
        'TELECALLER', 'FINANCE', 'ASS MANAGER', 'SOCIAL MEDIA MANAGER', 'SOCIAL MEDIA STAFF'
    ].includes(roleUpper) || Boolean(user.department) || Boolean(user.businessType);

    const isStudentAccount = !isExplicitStaff && (roleUpper === 'STUDENT' || roleUpper === 'USER');

    let sessionId = user.session_id;
    if (isStudentAccount) {
        sessionId = crypto.randomBytes(16).toString('hex');
        await prisma.user.update({
            where: { id: user.id },
            data: { session_id: sessionId }
        });
    }

    // Include Session ID in the token payload (Only evaluated for Students)
    const tokenPayload = { 
        userId: user.id, 
        role: user.role, 
        department: user.department, 
        businessType: user.businessType
    };
    if (isStudentAccount && sessionId) {
        tokenPayload.sessionId = sessionId;
    }

    const secretKey = process.env.JWT_SECRET || 'ima_jwt_sec_7d160fdbbfc131f568e69501f98cb67223270989b3051b802012b45efbf9f65e_2026';
    const token = jwt.sign(
      tokenPayload,
      secretKey, 
      { expiresIn: '30d' }
    );

    let userImage = user.image;
    if (isStudentAccount && (!userImage || userImage === 'default.png' || userImage === 'null')) {
      const { dpCode, imagePath } = getAvatarForPhone(user.phone || user.whatsapp);
      userImage = imagePath;
      await prisma.user.update({
        where: { id: user.id },
        data: { image: userImage, appChatDp: dpCode }
      }).catch(() => {});
    }

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName, 
        phone: user.phone,
        nic: user.nic,
        addressHouseNo: user.addressHouseNo,
        addressStreet: user.addressStreet,
        city: user.city,
        district: user.district,
        image: userImage,
        role: user.role,
        department: user.department,
        businessType: user.businessType
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error during login." });
  }
};

// authController.js
exports.ghostLogin = async (req, res) => {
  try {
    const callerId = req.user?.userId || req.user?.id;
    const callerRoleRaw = String(req.user?.role || '').trim();
    const callerRoleUpper = callerRoleRaw.toUpperCase().replace(/[\s-]/g, '_');
    const isAdmin = ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR'].includes(callerRoleUpper);
    const isManager = ['MANAGER', 'ASS_MANAGER', 'HEAD_MANAGER', 'SOCIAL_MEDIA_MANAGER', 'TECH_MANAGER'].includes(callerRoleUpper) || callerRoleUpper.includes('MANAGER');

    if (!isAdmin && !isManager) {
      return res.status(403).json({ error: "Unauthorized. Administrator or Manager privileges required." });
    }

    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
      return res.status(500).json({ error: "Server authentication configuration error." });
    }

    const staffId = parseInt(req.params.id, 10);
    if (isNaN(staffId) || staffId <= 0) {
      return res.status(400).json({ error: "Invalid staff ID format" });
    }

    if (callerId && staffId === callerId) {
      return res.status(400).json({ error: "Cannot ghost login to your own account." });
    }

    const user = await prisma.user.findUnique({ where: { id: staffId } });
    if (!user) {
      return res.status(404).json({ error: "User not found!" });
    }

    const targetRoleRaw = String(user.role || '').trim();
    const targetRoleUpper = targetRoleRaw.toUpperCase().replace(/[\s-]/g, '_');

    // ================= SECURITY GUARDS FOR MANAGERS =================
    if (isManager && !isAdmin) {
      // 1. Prevent Vertical Privilege Escalation: Managers cannot ghost login into Admins
      const isTargetAdmin = ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR'].includes(targetRoleUpper) || targetRoleUpper.includes('ADMIN') || targetRoleUpper.includes('DIRECTOR');
      if (isTargetAdmin) {
        console.warn(`[SECURITY ALERT] Manager ${callerId} (${callerRoleRaw}) attempted unauthorized ghost login into Admin user ${user.id} (${targetRoleRaw})`);
        return res.status(403).json({ error: "Security violation: Managers cannot ghost login into administrator accounts." });
      }

      // 2. Prevent Horizontal Escalation: Managers cannot ghost login into other Managers
      const isTargetManager = ['MANAGER', 'ASS_MANAGER', 'HEAD_MANAGER', 'SOCIAL_MEDIA_MANAGER', 'TECH_MANAGER'].includes(targetRoleUpper) || targetRoleUpper.includes('MANAGER') || targetRoleUpper === 'MANAGEMENT';
      if (isTargetManager) {
        console.warn(`[SECURITY ALERT] Manager ${callerId} (${callerRoleRaw}) attempted unauthorized ghost login into peer Manager user ${user.id} (${targetRoleRaw})`);
        return res.status(403).json({ error: "Security violation: Managers cannot ghost login into other manager accounts." });
      }

      // 3. Role Allowlist: Managers can only ghost login into subordinate operational roles
      const allowedSubordinateRoles = [
        'COORDINATOR', 'CALLER', 'CALL_CENTER_AGENT', 'TELECALLER',
        'STAFF', 'SOCIAL_MEDIA_STAFF', 'PAPER_GUIDER', 'LECTURE', 'LECTURER',
        'PAPER_MARKER', 'PAPER MARKER',
        'STUDENT', 'USER'
      ];
      if (!allowedSubordinateRoles.includes(targetRoleUpper)) {
        return res.status(403).json({ error: "Unauthorized: Managers can only ghost login into coordinators or subordinate staff." });
      }

      // 4. Department Scope Boundary: Ensure manager's department aligns with target or role
      const callerDept = String(req.user?.department || '').trim().toLowerCase();
      const targetDept = String(user.department || '').trim().toLowerCase();

      if (callerDept) {
        if (callerDept === 'class coordination') {
          // Class Coordination managers can access Coordinators and Class Coordination staff (including Paper Markers)
          if (targetRoleUpper !== 'COORDINATOR' && targetRoleUpper !== 'PAPER_MARKER' && targetRoleUpper !== 'PAPER MARKER' && targetDept !== 'class coordination') {
            return res.status(403).json({ error: "Unauthorized: Class Coordination managers can only ghost login into coordinators." });
          }
        } else if (callerDept === 'call center') {
          // Call Center managers can access Call Center staff / callers
          if (!['CALLER', 'CALL_CENTER_AGENT', 'TELECALLER'].includes(targetRoleUpper) && targetDept !== 'call center') {
            return res.status(403).json({ error: "Unauthorized: Call Center managers can only ghost login into call center agents." });
          }
        } else if (callerDept === 'social media') {
          if (!['SOCIAL_MEDIA_STAFF', 'STAFF'].includes(targetRoleUpper) && targetDept !== 'social media') {
            return res.status(403).json({ error: "Unauthorized: Social Media managers can only ghost login into social media staff." });
          }
        } else if (targetDept && callerDept !== targetDept && targetRoleUpper !== 'COORDINATOR') {
          return res.status(403).json({ error: "Unauthorized: Cross-department ghost login is not permitted." });
        }
      }
    }

    const isGhostStaff = [
      'ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'STAFF', 'COORDINATOR', 
      'CALLER', 'MANAGER', 'MANAGEMENT', 'TEACHER', 'INSTRUCTOR', 
      'TELECALLER', 'FINANCE', 'ASS MANAGER', 'SOCIAL MEDIA MANAGER', 'SOCIAL MEDIA STAFF',
      'PAPER_GUIDER', 'LECTURE', 'LECTURER', 'PAPER_MARKER', 'PAPER MARKER'
    ].includes(targetRoleUpper) || Boolean(user.department) || Boolean(user.businessType);

    const isGhostStudent = !isGhostStaff && (targetRoleUpper === 'STUDENT' || targetRoleUpper === 'USER');

    let sessionId = user.session_id;
    if (isGhostStudent) {
      sessionId = crypto.randomBytes(16).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: { session_id: sessionId }
      });
    }

    // Token claims with explicit impersonation metadata
    const tokenPayload = { 
      userId: user.id, 
      role: user.role, 
      department: user.department, 
      businessType: user.businessType,
      isGhost: true,
      ghostBy: callerId,
      ghostRole: req.user?.role
    };
    if (isGhostStudent && sessionId) {
      tokenPayload.sessionId = sessionId;
    }

    // 1-day short-lived token for ghost sessions
    const token = jwt.sign(
      tokenPayload,
      secretKey, 
      { expiresIn: '1d' }
    );

    // ================= AUDIT LOGGING =================
    try {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
      await prisma.systemAuditLog.create({
        data: {
          userId: callerId ? parseInt(callerId) : null,
          role: req.user?.role || null,
          method: 'POST',
          endpoint: `/api/auth/ghost-login/${user.id}`,
          payload: {
            action: 'GHOST_LOGIN',
            impersonatorId: callerId,
            impersonatorRole: req.user?.role,
            targetUserId: user.id,
            targetName: `${user.firstName} ${user.lastName}`,
            targetRole: user.role,
            targetDepartment: user.department
          },
          ipAddress: clientIp ? String(clientIp).split(',')[0].trim() : null,
          statusCode: 200
        }
      });
    } catch (auditErr) {
      console.error("[GhostLogin Audit Log Error]:", auditErr);
    }

    console.log(`[GHOST LOGIN SUCCESS] User ${callerId} (${req.user?.role}) impersonated ${user.id} (${user.role})`);

    // CRITICAL SECURITY FIX: Strip password hash before sending to client
    delete user.password;

    res.status(200).json({
      message: "Ghost login successful",
      token,
      user
    });

  } catch (error) {
    console.error("=== GHOST LOGIN ERROR ===", error);
    res.status(500).json({ error: "Server error during ghost login." });
  }
};