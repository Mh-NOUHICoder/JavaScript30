const inputs = document.querySelectorAll('.controls input');
const hl = document.querySelector('.hl');

function handleChange() {
    const suffix = this.dataset.sizing || '';
    document.documentElement.style.setProperty(`--${this.name}`, this.value + suffix);
    hl.style.setProperty(`--base`, this.value );
}

inputs.forEach(input => input.addEventListener('change', handleChange));
inputs.forEach(input => input.addEventListener('mousemove', handleChange));
