export const salesLabels = ["Apr 20", "Apr 21", "Apr 22", "Apr 23", "Apr 24", "Apr 25", "Apr 26"]
export const salesData = [12000, 21000, 15000, 22000, 20000, 24000, 34000]

export const recentSales = [
  { id: "00124", name: "Robert Smith", car: "BMW 3 Series", date: "2025-04-26", amount: "$42,000", status: "Completed", img: "https://i.pravatar.cc/60?img=11" },
  { id: "00123", name: "Sarah Johnson", car: "Honda Civic", date: "2025-04-25", amount: "$28,500", status: "Completed", img: "https://i.pravatar.cc/60?img=32" },
  { id: "00122", name: "Michael Brown", car: "Ford Mustang", date: "2025-04-24", amount: "$36,000", status: "Pending", img: "https://i.pravatar.cc/60?img=15" },
  { id: "00121", name: "Emily Davis", car: "Toyota Camry", date: "2025-04-23", amount: "$24,800", status: "Completed", img: "https://i.pravatar.cc/60?img=47" },
  { id: "00120", name: "David Wilson", car: "Chevrolet Silverado", date: "2025-04-22", amount: "$44,900", status: "Completed", img: "https://i.pravatar.cc/60?img=53" },
]

export const topCars = [
  { name: "Toyota Camry", sold: 48, img: "https://images.unsplash.com/photo-1621007690695-33cd1a41d8f6?q=80&w=200&auto=format&fit=crop" },
  { name: "Honda Civic", sold: 36, img: "https://images.unsplash.com/photo-1590362891991-f776e747a588?q=80&w=200&auto=format&fit=crop" },
  { name: "Ford Mustang", sold: 28, img: "https://images.unsplash.com/photo-1584345604476-8ec5f452d1f2?q=80&w=200&auto=format&fit=crop" },
  { name: "BMW 3 Series", sold: 22, img: "https://images.unsplash.com/photo-1523983388277-336a66bf9bcd?q=80&w=200&auto=format&fit=crop" },
  { name: "Chevrolet Silverado", sold: 18, img: "https://images.unsplash.com/photo-1594502184342-2543858ef706?q=80&w=200&auto=format&fit=crop" },
]

export const activities = [
  { icon: "red", title: "New car added", sub: "Toyota Camry 2022", time: "2 hours ago", type: "car" },
  { icon: "green", title: "Customer registered", sub: "John Doe", time: "3 hours ago", type: "user" },
  { icon: "red", title: "Sale completed", sub: "Honda Civic 2021", time: "5 hours ago", type: "tag" },
  { icon: "blue", title: "Appointment scheduled", sub: "Test drive - Ford Mustang", time: "6 hours ago", type: "cal" },
  { icon: "grey", title: "User created", sub: "Sales Associate", time: "8 hours ago", type: "user" },
]

export const donutData = {
  labels: ["Sedan", "SUV", "Truck", "Coupe", "Other"],
  values: [42, 28, 18, 8, 4],
  colors: ["#141c2e", "#e8342c", "#8b93a5", "#c7cbd6", "#e4e6ec"],
}

export const statCards = [
  { label: "Total Inventory", value: "248", change: "12%", up: true, icon: "car", tone: "red" },
  { label: "Total Customers", value: "1,024", change: "8%", up: true, icon: "users", tone: "dark" },
  { label: "Total Sales", value: "$1,248,000", change: "15%", up: true, icon: "tag", tone: "red" },
  { label: "Pending Appointments", value: "32", change: "5%", up: false, icon: "cal", tone: "dark" },
]
